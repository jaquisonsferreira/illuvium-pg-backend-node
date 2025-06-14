import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ethers,
  WebSocketProvider,
  JsonRpcProvider,
  Contract,
  EventLog,
} from 'ethers';
import { SUPPORTED_NETWORKS, OBELISK_CONTRACTS } from '../../constants';
import { OBELISK_MARKETPLACE_ABI } from '../../domain/contracts/obelisk-marketplace.abi';
import { OBELISK_ORDER_MANAGER_ABI } from '../../domain/contracts/obelisk-order-manager.abi';
import { OBELISK_ROYALTY_MANAGER_ABI } from '../../domain/contracts/obelisk-royalty-manager.abi';

// Standard ERC interfaces
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
];

const ERC1155_ABI = [
  'function uri(uint256 id) view returns (string)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
  'event ApprovalForAll(address indexed account, address indexed operator, bool approved)',
];

const PAUSABLE_ABI = [
  'event Paused(address account)',
  'event Unpaused(address account)',
];

const OWNABLE_ABI = [
  'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',
];

export interface ContractInfo {
  address: string;
  type: 'ERC20' | 'ERC721' | 'ERC1155' | 'Unknown';
  name?: string;
  symbol?: string;
  decimals?: number;
}

export interface NetworkProvider {
  jsonRpc: JsonRpcProvider;
  webSocket?: WebSocketProvider;
}

@Injectable()
export class ContractInteractionService {
  private readonly logger = new Logger(ContractInteractionService.name);
  private readonly providers: Map<string, NetworkProvider> = new Map();
  private readonly obeliskContracts: Map<string, Contract> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeProviders();
    this.initializeObeliskContracts();
  }

  private initializeProviders(): void {
    for (const [networkKey, networkConfig] of Object.entries(
      SUPPORTED_NETWORKS,
    )) {
      try {
        if (!networkConfig.rpcUrl) {
          this.logger.warn(`No RPC URL configured for ${networkConfig.name}`);
          continue;
        }

        const jsonRpc = new JsonRpcProvider(networkConfig.rpcUrl);
        let webSocket: WebSocketProvider | undefined;

        if (networkConfig.wsUrl) {
          try {
            webSocket = new WebSocketProvider(networkConfig.wsUrl);
          } catch (error) {
            this.logger.warn(
              `Failed to initialize WebSocket for ${networkConfig.name}:`,
              error,
            );
          }
        }

        this.providers.set(networkConfig.name, { jsonRpc, webSocket });
        this.logger.log(`Initialized providers for ${networkConfig.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to initialize providers for ${networkKey}:`,
          error,
        );
      }
    }
  }

  private initializeObeliskContracts(): void {
    const obeliskProvider = this.providers.get('obelisk-testnet');
    if (!obeliskProvider) {
      this.logger.warn(
        'Obelisk provider not available for contract initialization',
      );
      return;
    }

    try {
      this.obeliskContracts.set(
        'marketplace',
        new Contract(
          OBELISK_CONTRACTS.MARKETPLACE_PROXY,
          OBELISK_MARKETPLACE_ABI,
          obeliskProvider.jsonRpc,
        ),
      );

      this.obeliskContracts.set(
        'orderManager',
        new Contract(
          OBELISK_CONTRACTS.ORDER_MANAGER_PROXY,
          OBELISK_ORDER_MANAGER_ABI,
          obeliskProvider.jsonRpc,
        ),
      );

      this.obeliskContracts.set(
        'royaltyManager',
        new Contract(
          OBELISK_CONTRACTS.ROYALTY_MANAGER_PROXY,
          OBELISK_ROYALTY_MANAGER_ABI,
          obeliskProvider.jsonRpc,
        ),
      );

      this.logger.log('Initialized Obelisk contracts');
    } catch (error) {
      this.logger.error('Failed to initialize Obelisk contracts:', error);
    }
  }

  getObeliskContract(
    contractName: 'marketplace' | 'orderManager' | 'royaltyManager',
  ): Contract | undefined {
    return this.obeliskContracts.get(contractName);
  }

  getObeliskContracts(): {
    marketplace?: Contract;
    orderManager?: Contract;
    royaltyManager?: Contract;
  } {
    return {
      marketplace: this.obeliskContracts.get('marketplace'),
      orderManager: this.obeliskContracts.get('orderManager'),
      royaltyManager: this.obeliskContracts.get('royaltyManager'),
    };
  }

  getProvider(networkName: string): NetworkProvider | undefined {
    return this.providers.get(networkName);
  }

  async detectContractType(
    contractAddress: string,
    networkName: string,
  ): Promise<ContractInfo> {
    const provider = this.getProvider(networkName);
    if (!provider) {
      throw new Error(`No provider available for network: ${networkName}`);
    }

    try {
      // Check if it's a valid contract
      const code = await provider.jsonRpc.getCode(contractAddress);
      if (code === '0x') {
        throw new Error('Address is not a contract');
      }

      let contractInfo: ContractInfo = {
        address: contractAddress,
        type: 'Unknown',
      };

      // Try ERC721 first (most specific)
      try {
        const erc721Contract = new Contract(
          contractAddress,
          ERC721_ABI,
          provider.jsonRpc,
        );
        const name = await erc721Contract.name();
        const symbol = await erc721Contract.symbol();

        contractInfo = {
          address: contractAddress,
          type: 'ERC721',
          name,
          symbol,
        };

        this.logger.log(`Detected ERC721 contract: ${name} (${symbol})`);
        return contractInfo;
      } catch {
        // Not ERC721, continue checking
      }

      // Try ERC1155
      try {
        const erc1155Contract = new Contract(
          contractAddress,
          ERC1155_ABI,
          provider.jsonRpc,
        );
        // ERC1155 doesn't have name/symbol, so we just check if uri() works
        await erc1155Contract.uri(1);

        contractInfo = {
          address: contractAddress,
          type: 'ERC1155',
        };

        this.logger.log(`Detected ERC1155 contract`);
        return contractInfo;
      } catch {
        // Not ERC1155, continue checking
      }

      // Try ERC20
      try {
        const erc20Contract = new Contract(
          contractAddress,
          ERC20_ABI,
          provider.jsonRpc,
        );
        const name = await erc20Contract.name();
        const symbol = await erc20Contract.symbol();
        const decimals = await erc20Contract.decimals();

        contractInfo = {
          address: contractAddress,
          type: 'ERC20',
          name,
          symbol,
          decimals: Number(decimals),
        };

        this.logger.log(`Detected ERC20 contract: ${name} (${symbol})`);
        return contractInfo;
      } catch {
        // Not ERC20
      }

      this.logger.warn(`Could not detect contract type for ${contractAddress}`);
      return contractInfo;
    } catch (error) {
      this.logger.error(
        `Error detecting contract type for ${contractAddress}:`,
        error,
      );
      throw error;
    }
  }

  async getContractEvents(
    contractAddress: string,
    networkName: string,
    fromBlock: number,
    toBlock: number,
    eventNames?: string[],
  ): Promise<EventLog[]> {
    const provider = this.getProvider(networkName);
    if (!provider) {
      throw new Error(`No provider available for network: ${networkName}`);
    }

    try {
      const contract = new Contract(
        contractAddress,
        [
          ...ERC20_ABI,
          ...ERC721_ABI,
          ...ERC1155_ABI,
          ...PAUSABLE_ABI,
          ...OWNABLE_ABI,
        ],
        provider.jsonRpc,
      );

      const filter = {
        address: contractAddress,
        fromBlock,
        toBlock,
      };

      const logs = await provider.jsonRpc.getLogs(filter);

      const parsedEvents: EventLog[] = [];

      for (const log of logs) {
        try {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });

          if (
            parsedLog &&
            (!eventNames || eventNames.includes(parsedLog.name))
          ) {
            const eventLog = {
              ...log,
              interface: contract.interface,
              fragment: parsedLog.fragment,
              name: parsedLog.name,
              args: parsedLog.args,
            } as unknown as EventLog;

            parsedEvents.push(eventLog);
          }
        } catch {
          continue;
        }
      }

      this.logger.log(
        `Retrieved ${parsedEvents.length} events from ${contractAddress} (blocks ${fromBlock}-${toBlock})`,
      );
      return parsedEvents;
    } catch (error) {
      this.logger.error(`Error getting contract events:`, error);
      throw error;
    }
  }

  async getLatestBlockNumber(networkName: string): Promise<number> {
    const provider = this.getProvider(networkName);
    if (!provider) {
      throw new Error(`No provider available for network: ${networkName}`);
    }

    try {
      const blockNumber = await provider.jsonRpc.getBlockNumber();
      return blockNumber;
    } catch (error) {
      this.logger.error(
        `Error getting latest block number for ${networkName}:`,
        error,
      );
      throw error;
    }
  }

  async getBlock(networkName: string, blockNumber: number): Promise<any> {
    const provider = this.getProvider(networkName);
    if (!provider) {
      throw new Error(`No provider available for network: ${networkName}`);
    }

    try {
      const block = await provider.jsonRpc.getBlock(blockNumber, true);
      return block;
    } catch (error) {
      this.logger.error(
        `Error getting block ${blockNumber} for ${networkName}:`,
        error,
      );
      throw error;
    }
  }

  async getTransactionReceipt(
    networkName: string,
    txHash: string,
  ): Promise<any> {
    const provider = this.getProvider(networkName);
    if (!provider) {
      throw new Error(`No provider available for network: ${networkName}`);
    }

    try {
      const receipt = await provider.jsonRpc.getTransactionReceipt(txHash);
      return receipt;
    } catch (error) {
      this.logger.error(
        `Error getting transaction receipt for ${txHash}:`,
        error,
      );
      throw error;
    }
  }

  async getEthTransfersFromBlock(
    networkName: string,
    blockNumber: number,
  ): Promise<any[]> {
    const provider = this.getProvider(networkName);
    if (!provider) {
      throw new Error(`No provider available for network: ${networkName}`);
    }

    try {
      const block = await provider.jsonRpc.getBlock(blockNumber, true);
      if (!block || !block.transactions) {
        return [];
      }

      const ethTransfers: any[] = [];

      for (const tx of block.transactions) {
        if (typeof tx === 'string') continue;

        const transaction = tx as any;

        if (
          transaction.to &&
          transaction.value &&
          ethers.getBigInt(transaction.value) > 0 &&
          !transaction.data
        ) {
          ethTransfers.push({
            from: transaction.from,
            to: transaction.to,
            value: transaction.value.toString(),
            transactionHash: transaction.hash,
            blockNumber: block.number,
            blockHash: block.hash,
          });
        }
      }

      return ethTransfers;
    } catch (error) {
      this.logger.error(
        `Error getting ETH transfers from block ${blockNumber}:`,
        error,
      );
      throw error;
    }
  }

  async testConnectivity(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [networkName, provider] of this.providers.entries()) {
      try {
        const blockNumber = await provider.jsonRpc.getBlockNumber();
        results[networkName] = blockNumber > 0;
        this.logger.log(
          `${networkName} connectivity: OK (block ${blockNumber})`,
        );
      } catch (error) {
        results[networkName] = false;
        this.logger.error(`${networkName} connectivity: FAILED`, error);
      }
    }

    return results;
  }
}
