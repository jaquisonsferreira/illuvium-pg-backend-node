import { Injectable, Inject, Logger } from '@nestjs/common';
import { ContractInteractionService } from './contract-interaction.service';
import { ProcessBlockchainEventUseCase } from '../../application/use-cases/process-blockchain-event.use-case';
import { BlockchainContractRepositoryInterface } from '../../../assets/domain/repositories/blockchain-contract.repository.interface';
import { BlockchainContract } from '../../../assets/domain/entities/blockchain-contract.entity';
import { ContractDiscoveredEvent } from '../../domain/types/blockchain-event.types';
import { BLOCKCHAIN_CONTRACT_REPOSITORY } from '../../../assets/constants';
import { BLOCKCHAIN_EVENT_TYPES, SUPPORTED_NETWORKS } from '../../constants';

@Injectable()
export class ContractDiscoveryService {
  private readonly logger = new Logger(ContractDiscoveryService.name);

  constructor(
    private readonly contractService: ContractInteractionService,
    private readonly processEventUseCase: ProcessBlockchainEventUseCase,
    @Inject(BLOCKCHAIN_CONTRACT_REPOSITORY)
    private readonly contractRepository: BlockchainContractRepositoryInterface,
  ) {}

  async discoverContract(
    contractAddress: string,
    networkName: string,
  ): Promise<BlockchainContract | null> {
    try {
      this.logger.log(
        `Discovering contract: ${contractAddress} on ${networkName}`,
      );

      const existingContract =
        await this.contractRepository.findByAddress(contractAddress);
      if (existingContract) {
        this.logger.debug(`Contract already exists: ${contractAddress}`);
        return existingContract;
      }

      const contractInfo = await this.contractService.detectContractType(
        contractAddress,
        networkName,
      );

      if (contractInfo.type === 'Unknown') {
        this.logger.warn(
          `Could not determine contract type for: ${contractAddress}`,
        );
        return null;
      }

      const contract = new BlockchainContract({
        address: contractInfo.address,
        contractType: contractInfo.type,
        name: contractInfo.name || 'Unknown',
        symbol: contractInfo.symbol || 'UNKNOWN',
        decimals: contractInfo.decimals,
        network: networkName,
        isActive: true,
      });

      const savedContract = await this.contractRepository.create(contract);

      const discoveryEvent: ContractDiscoveredEvent = {
        eventType: BLOCKCHAIN_EVENT_TYPES.CONTRACT_DISCOVERED,
        networkName,
        blockNumber:
          await this.contractService.getLatestBlockNumber(networkName),
        transactionHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        blockHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        logIndex: 0,
        timestamp: new Date(),
        contractAddress: contractInfo.address,
        contractType: contractInfo.type,
        name: contractInfo.name,
        symbol: contractInfo.symbol,
        decimals: contractInfo.decimals,
      };

      await this.processEventUseCase.execute(discoveryEvent);

      this.logger.log(
        `Successfully discovered and registered contract: ${contractInfo.type} ${contractInfo.name || 'Unknown'} (${contractAddress})`,
      );

      return savedContract;
    } catch (error) {
      this.logger.error(
        `Failed to discover contract: ${contractAddress}`,
        error,
      );
      return null;
    }
  }

  async discoverContractsFromTransactions(
    networkName: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<string[]> {
    const discoveredContracts: string[] = [];

    try {
      this.logger.log(
        `Scanning for contracts in blocks ${fromBlock}-${toBlock} on ${networkName}`,
      );

      for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
        const block = await this.contractService.getBlock(
          networkName,
          blockNumber,
        );

        if (!block?.transactions) continue;

        for (const tx of block.transactions) {
          const receipt = await this.contractService.getTransactionReceipt(
            networkName,
            tx.hash || tx,
          );

          if (receipt?.contractAddress) {
            const contractAddress = receipt.contractAddress;

            if (!discoveredContracts.includes(contractAddress)) {
              const contract = await this.discoverContract(
                contractAddress,
                networkName,
              );
              if (contract) {
                discoveredContracts.push(contractAddress);
              }
            }
          }

          for (const log of receipt?.logs || []) {
            if (log.address && !discoveredContracts.includes(log.address)) {
              const contract = await this.discoverContract(
                log.address,
                networkName,
              );
              if (contract) {
                discoveredContracts.push(log.address);
              }
            }
          }
        }
      }

      this.logger.log(
        `Discovered ${discoveredContracts.length} new contracts in blocks ${fromBlock}-${toBlock}`,
      );

      return discoveredContracts;
    } catch (error) {
      this.logger.error(
        `Error discovering contracts from blocks ${fromBlock}-${toBlock}:`,
        error,
      );
      return discoveredContracts;
    }
  }

  async refreshContractInfo(
    contractAddress: string,
    networkName: string,
  ): Promise<boolean> {
    try {
      const existingContract =
        await this.contractRepository.findByAddress(contractAddress);
      if (!existingContract) {
        this.logger.warn(`Contract not found for refresh: ${contractAddress}`);
        return false;
      }

      const contractInfo = await this.contractService.detectContractType(
        contractAddress,
        networkName,
      );

      if (contractInfo.type === 'Unknown') {
        await this.contractRepository.update(existingContract.id, {
          isActive: false,
        });
        this.logger.warn(`Marked contract as inactive: ${contractAddress}`);
        return false;
      }

      await this.contractRepository.update(existingContract.id, {
        name: contractInfo.name,
        symbol: contractInfo.symbol,
        decimals: contractInfo.decimals,
        isActive: true,
      });

      this.logger.log(`Refreshed contract info: ${contractAddress}`);
      return true;
    } catch (error) {
      this.logger.error(`Error refreshing contract: ${contractAddress}`, error);
      return false;
    }
  }

  async getKnownContracts(networkName?: string): Promise<BlockchainContract[]> {
    try {
      const allContracts = await this.contractRepository.findActive();

      if (networkName) {
        return allContracts.filter(
          (contract) => contract.network === networkName,
        );
      }

      return allContracts;
    } catch (error) {
      this.logger.error('Error getting known contracts', error);
      return [];
    }
  }

  async syncAllNetworks(): Promise<void> {
    const supportedNetworks = Object.values(SUPPORTED_NETWORKS);

    for (const network of supportedNetworks) {
      try {
        const connectivity = await this.contractService.testConnectivity();
        if (!connectivity[network.name]) {
          this.logger.warn(`Skipping sync for ${network.name} - not connected`);
          continue;
        }

        const latestBlock = await this.contractService.getLatestBlockNumber(
          network.name,
        );
        const fromBlock = Math.max(0, latestBlock - 100); // Sync last 100 blocks

        await this.discoverContractsFromTransactions(
          network.name,
          fromBlock,
          latestBlock,
        );
      } catch (error) {
        this.logger.error(`Error syncing network ${network.name}:`, error);
      }
    }
  }
}
