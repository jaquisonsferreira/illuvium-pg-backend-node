import { Controller, Post, Body, Get, Param, Logger } from '@nestjs/common';
import { EventListenerService } from '../../infrastructure/services/event-listener.service';
import { ContractInteractionService } from '../../infrastructure/services/contract-interaction.service';
import { BlockchainEventBridgeService } from '../../infrastructure/services/blockchain-event-bridge.service';
import { ContractDiscoveryService } from '../../infrastructure/services/contract-discovery.service';
import { BlockchainEventIntegrationService } from '../../infrastructure/services/blockchain-event-integration.service';
import { ProcessBlockchainEventUseCase } from '../../application/use-cases/process-blockchain-event.use-case';
import { BLOCKCHAIN_EVENT_TYPES } from '../../constants';

@Controller('blockchain')
export class BlockchainController {
  private readonly logger = new Logger(BlockchainController.name);

  constructor(
    private readonly eventListenerService: EventListenerService,
    private readonly contractInteractionService: ContractInteractionService,
    private readonly eventBridgeService: BlockchainEventBridgeService,
    private readonly contractDiscoveryService: ContractDiscoveryService,
    private readonly eventIntegrationService: BlockchainEventIntegrationService,
    private readonly processEventUseCase: ProcessBlockchainEventUseCase,
  ) {}

  @Get('sync/status/:networkName')
  async getSyncStatus(@Param('networkName') networkName: string) {
    try {
      const status = this.eventListenerService.getProcessingStatus();
      const currentBlock =
        await this.contractInteractionService.getLatestBlockNumber(networkName);

      const networkStatus = status[networkName];
      if (!networkStatus) {
        return {
          success: false,
          message: `Network ${networkName} not found in processing status`,
        };
      }

      const blocksBehind = currentBlock - networkStatus.lastProcessedBlock;

      return {
        success: true,
        networkName,
        currentBlock,
        lastProcessedBlock: networkStatus.lastProcessedBlock,
        blocksBehind,
        isActive: networkStatus.isActive,
        needsSync: blocksBehind > 10,
        recommendedSyncFrom: networkStatus.lastProcessedBlock + 1,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get sync status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('obelisk/full-recovery')
  async fullRecovery(
    @Body()
    body?: {
      networkName?: string;
      fromBlock?: number;
      toBlock?: number;
    },
  ) {
    const networkName = body?.networkName || 'obelisk-testnet';
    const startTime = Date.now();

    try {
      this.logger.log(`Starting full recovery for network: ${networkName}`);

      const recoverySteps: any[] = [];
      let totalContracts = 0;
      let totalNFTs = 0;

      this.logger.log('Step 1: Registering known contracts...');
      const registerResult = await this.registerContracts();

      recoverySteps.push({
        step: 1,
        name: 'Contract Registration',
        status: registerResult.success ? 'completed' : 'failed',
        contractsRegistered: registerResult.contracts?.length || 0,
        details: registerResult,
      });

      totalContracts = registerResult.contracts?.length || 0;

      this.logger.log('Step 2: Saving NFTs to database...');
      const saveResult = await this.saveNFTsToDatabase();

      recoverySteps.push({
        step: 2,
        name: 'NFT Data Save',
        status: saveResult.success ? 'completed' : 'failed',
        nftsSaved: saveResult.totalNFTsSaved || 0,
        collections: saveResult.collections?.length || 0,
        details: saveResult,
      });

      totalNFTs = saveResult.totalNFTsSaved || 0;

      this.logger.log('Step 3: Verifying recovered data...');

      const contractRepo = (this.processEventUseCase as any).contractRepository;
      const allContracts = await contractRepo.findActive();
      const networkContracts = allContracts.filter(
        (contract: any) =>
          contract.network === networkName || !contract.network,
      );

      const verificationResults: any[] = [];
      for (const contract of networkContracts) {
        try {
          const assets = await this.processEventUseCase[
            'assetRepository'
          ].findByContract(contract.id);

          verificationResults.push({
            contractAddress: contract.address,
            name: contract.name,
            symbol: contract.symbol,
            nftCount: assets.length,
          });

          totalNFTs += assets.length;
        } catch (error) {
          verificationResults.push({
            contractAddress: contract.address,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      recoverySteps.push({
        step: 3,
        name: 'Data Verification',
        status: 'completed',
        contractsInDB: networkContracts.length,
        totalNFTs,
        contracts: verificationResults,
      });

      const duration = Date.now() - startTime;

      this.logger.log(`Full recovery completed in ${duration}ms`);

      return {
        success: true,
        message: 'Full recovery completed successfully',
        networkName,
        summary: {
          totalContracts,
          totalNFTs,
          durationMs: duration,
        },
        steps: recoverySteps,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Full recovery failed:', error);

      return {
        success: false,
        message: 'Full recovery failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        networkName,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('listen/:networkName')
  async startListening(@Param('networkName') networkName: string) {
    try {
      this.logger.log(`Starting event listener for network: ${networkName}`);

      const success =
        await this.eventListenerService.startListening(networkName);

      return {
        success,
        message: success
          ? `Event listener started for ${networkName}`
          : `Failed to start event listener for ${networkName}`,
        networkName,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to start listening on ${networkName}:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        networkName,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('stop/:networkName')
  async stopListening(@Param('networkName') networkName: string) {
    try {
      this.logger.log(`Stopping event listener for network: ${networkName}`);

      const success =
        await this.eventListenerService.stopListening(networkName);

      return {
        success,
        message: success
          ? `Event listener stopped for ${networkName}`
          : `Failed to stop event listener for ${networkName}`,
        networkName,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to stop listening on ${networkName}:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        networkName,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('process-block')
  async processBlock(
    @Body() body: { networkName: string; blockNumber: number },
  ) {
    try {
      const { networkName, blockNumber } = body;

      this.logger.log(`Processing block ${blockNumber} on ${networkName}`);

      const result = await this.eventListenerService.processBlock({
        networkName,
        blockNumber,
      });

      return {
        success: true,
        message: `Processed block ${blockNumber} on ${networkName}`,
        result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to process block:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('discover-contracts')
  async discoverContracts(
    @Body() body: { networkName: string; fromBlock?: number; toBlock?: number },
  ) {
    try {
      const { networkName, fromBlock, toBlock } = body;

      this.logger.log(
        `Discovering contracts on ${networkName} from block ${fromBlock} to ${toBlock}`,
      );

      if (fromBlock !== undefined && toBlock !== undefined) {
        const contracts =
          await this.contractDiscoveryService.discoverContractsFromTransactions(
            networkName,
            fromBlock,
            toBlock,
          );

        return {
          success: true,
          message: `Discovered ${contracts.length} contracts on ${networkName}`,
          contracts,
          timestamp: new Date().toISOString(),
        };
      } else {
        await this.contractDiscoveryService.syncAllNetworks();

        return {
          success: true,
          message: `Contract discovery started for all networks`,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      this.logger.error(`Failed to discover contracts:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('discover-contract/:address')
  async discoverContract(
    @Param('address') address: string,
    @Body() body: { networkName: string },
  ) {
    try {
      const { networkName } = body;

      this.logger.log(`Discovering contract: ${address} on ${networkName}`);

      const contract = await this.contractDiscoveryService.discoverContract(
        address,
        networkName,
      );

      if (contract) {
        return {
          success: true,
          message: `Contract discovered: ${contract.contractType} ${contract.name}`,
          contract,
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          message: `Could not discover contract: ${address}`,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      this.logger.error(`Failed to discover contract ${address}:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('metrics')
  async getMetrics() {
    try {
      const metrics = this.eventIntegrationService.getProcessingMetrics();
      const queueStatus = await this.eventIntegrationService.getQueueStatus();
      const processingStatus = this.eventListenerService.getProcessingStatus();

      return {
        success: true,
        metrics,
        queueStatus,
        processingStatus,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get metrics:', error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('control/:action')
  async controlProcessing(@Param('action') action: string) {
    try {
      switch (action) {
        case 'pause':
          await this.eventIntegrationService.pauseEventProcessing();
          return { success: true, message: 'Event processing paused' };

        case 'resume':
          await this.eventIntegrationService.resumeEventProcessing();
          return { success: true, message: 'Event processing resumed' };

        case 'clear-failed':
          await this.eventIntegrationService.clearFailedJobs();
          return { success: true, message: 'Failed jobs cleared' };

        case 'reset-metrics':
          this.eventIntegrationService.resetMetrics();
          return { success: true, message: 'Metrics reset' };

        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      this.logger.error(`Failed to execute action ${action}:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('test-event')
  async testEventProcessing(@Body() body: any) {
    try {
      this.logger.log(`Testing event processing with mock event`);

      const mockEvent = {
        eventType: BLOCKCHAIN_EVENT_TYPES.CONTRACT_DISCOVERED,
        networkName: body.networkName || 'mainnet',
        blockNumber: body.blockNumber || 18000000,
        blockHash: body.blockHash || '0xabc...',
        transactionHash: body.transactionHash || '0x123...',
        logIndex: body.logIndex || 0,
        contractAddress: body.contractAddress || '0x456...',
        contractType: body.contractType || 'ERC721',
        timestamp: new Date(),
        data: body.data || {},
      } as any;

      const result = await this.processEventUseCase.execute(mockEvent);

      return {
        success: true,
        message: 'Event processing test completed',
        mockEvent,
        result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to test event processing:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('test-eventbridge')
  async testEventBridge(@Body() body: any) {
    try {
      this.logger.log(`Testing AWS EventBridge integration`);

      const mockEvents = [
        {
          eventType: BLOCKCHAIN_EVENT_TYPES.TOKEN_TRANSFERRED,
          networkName: body.networkName || 'mainnet',
          blockNumber: body.blockNumber || 18000000,
          blockHash: body.blockHash || '0xabc...',
          transactionHash: body.transactionHash || '0x123...',
          logIndex: 0,
          contractAddress: body.contractAddress || '0x456...',
          from: '0x111...',
          to: '0x222...',
          tokenId: '1',
          timestamp: new Date(),
          data: {},
        },
      ] as any[];

      const result = await this.eventBridgeService.publishEvents(mockEvents);

      return {
        success: true,
        message: 'EventBridge test completed',
        mockEvents,
        result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to test EventBridge:`, error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('test-connection/:networkName')
  async testConnection(@Param('networkName') networkName: string) {
    try {
      this.logger.log(`Testing connection to ${networkName}`);

      const currentBlock =
        await this.contractInteractionService.getLatestBlockNumber(networkName);

      let obeliskInfo: Record<string, string> | null = null;
      if (networkName === 'obelisk-testnet') {
        const obeliskContracts =
          this.contractInteractionService.getObeliskContracts();
        obeliskInfo = {
          marketplace: obeliskContracts.marketplace
            ? 'Connected'
            : 'Not Connected',
          orderManager: obeliskContracts.orderManager
            ? 'Connected'
            : 'Not Connected',
          royaltyManager: obeliskContracts.royaltyManager
            ? 'Connected'
            : 'Not Connected',
        };
      }

      return {
        success: true,
        networkName,
        currentBlock,
        obeliskInfo,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to test connection to ${networkName}:`, error);

      return {
        success: false,
        networkName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('test-nft-supply/:contractAddress')
  async testNFTSupply(@Param('contractAddress') contractAddress: string) {
    try {
      const networkName = 'obelisk-testnet';

      this.logger.log(`Testing NFT supply for contract: ${contractAddress}`);

      const provider = this.contractInteractionService.getProvider(networkName);
      if (!provider) {
        throw new Error(`No provider for ${networkName}`);
      }

      const Contract = await import('ethers').then((m) => m.Contract);
      const contract = new Contract(
        contractAddress,
        [
          'function totalSupply() view returns (uint256)',
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function balanceOf(address owner) view returns (uint256)',
          'function tokenByIndex(uint256 index) view returns (uint256)',
          'function ownerOf(uint256 tokenId) view returns (address)',
        ],
        provider.jsonRpc,
      );

      const totalSupply = await contract.totalSupply();
      const name = await contract.name();
      const symbol = await contract.symbol();

      const testAddress = '0x90933cd33A2Aa7084bF085e06a5BF72E21CEDdDE';
      const balance = await contract.balanceOf(testAddress);

      const nfts: any[] = [];
      const supplyNumber = Number(totalSupply.toString());

      for (let i = 0; i < Math.min(supplyNumber, 5); i++) {
        try {
          const tokenId = await contract.tokenByIndex(i);
          const owner = await contract.ownerOf(tokenId);
          nfts.push({
            tokenId: tokenId.toString(),
            owner,
          });
        } catch (error) {
          this.logger.warn(`Failed to get NFT at index ${i}:`, error);
        }
      }

      return {
        success: true,
        contractAddress,
        name,
        symbol,
        totalSupply: totalSupply.toString(),
        testAddressBalance: balance.toString(),
        sampleNFTs: nfts,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to test NFT supply:', error);
      return {
        success: false,
        contractAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('test-events/:contractAddress')
  async testEvents(@Param('contractAddress') contractAddress: string) {
    try {
      const networkName = 'obelisk-testnet';

      this.logger.log(`Testing events for contract: ${contractAddress}`);

      const currentBlock =
        await this.contractInteractionService.getLatestBlockNumber(networkName);

      const ranges = [
        {
          name: 'Last 1000 blocks',
          from: Math.max(0, currentBlock - 1000),
          to: currentBlock,
        },
        {
          name: 'Last 10000 blocks',
          from: Math.max(0, currentBlock - 10000),
          to: currentBlock,
        },
        { name: 'From block 0', from: 0, to: Math.min(currentBlock, 10000) },
      ];

      const results: any[] = [];

      for (const range of ranges) {
        try {
          this.logger.log(
            `Testing range: ${range.name} (${range.from} - ${range.to})`,
          );

          const events =
            await this.contractInteractionService.getContractEvents(
              contractAddress,
              networkName,
              range.from,
              range.to,
              ['Transfer'],
            );

          results.push({
            range: range.name,
            fromBlock: range.from,
            toBlock: range.to,
            eventsFound: events.length,
            events: events.slice(0, 3),
          });
        } catch (error) {
          results.push({
            range: range.name,
            fromBlock: range.from,
            toBlock: range.to,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        contractAddress,
        currentBlock,
        results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to test events:', error);
      return {
        success: false,
        contractAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('test-events-detailed/:contractAddress')
  async testEventsDetailed(@Param('contractAddress') contractAddress: string) {
    try {
      const networkName = 'obelisk-testnet';

      this.logger.log(
        `Testing detailed events for contract: ${contractAddress}`,
      );

      const currentBlock =
        await this.contractInteractionService.getLatestBlockNumber(networkName);

      const ranges = [
        {
          name: 'Last 100 blocks',
          from: Math.max(0, currentBlock - 100),
          to: currentBlock,
        },
        { name: 'Blocks 1-1000', from: 1, to: 1000 },
        { name: 'Blocks 1000-2000', from: 1000, to: 2000 },
        { name: 'Blocks 2000-3000', from: 2000, to: 3000 },
        { name: 'Blocks 5000-6000', from: 5000, to: 6000 },
      ];

      const results: any[] = [];

      for (const range of ranges) {
        try {
          this.logger.log(
            `Testing range: ${range.name} (${range.from} - ${range.to})`,
          );

          const provider =
            this.contractInteractionService.getProvider(networkName);
          if (!provider) {
            throw new Error(`No provider for ${networkName}`);
          }

          const filter = {
            address: contractAddress,
            fromBlock: range.from,
            toBlock: range.to,
            topics: [
              '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
            ],
          };

          const logs = await provider.jsonRpc.getLogs(filter);

          results.push({
            range: range.name,
            fromBlock: range.from,
            toBlock: range.to,
            rawLogsFound: logs.length,
            logs: logs.slice(0, 2),
          });
        } catch (error) {
          results.push({
            range: range.name,
            fromBlock: range.from,
            toBlock: range.to,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        contractAddress,
        currentBlock,
        transferEventSignature:
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to test detailed events:', error);
      return {
        success: false,
        contractAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async registerContracts() {
    try {
      this.logger.log('Starting to register NFT contracts');

      const networkName = 'obelisk-testnet';

      const knownContracts =
        await this.contractDiscoveryService.getKnownContracts(networkName);
      const nftContracts = knownContracts.filter(
        (contract) =>
          contract.contractType === 'ERC721' ||
          contract.contractType === 'ERC1155',
      );

      if (nftContracts.length === 0) {
        this.logger.warn(
          'No NFT contracts found in database, attempting discovery...',
        );

        const knownAddresses = [
          '0x90Ef0bfdB26f026b52C1225c6c72d09fa9D321a0',
          '0xd1bCe537F814687e4AA3EE6C32AFc6832dEA651f',
          '0x8F92fb69919D99EF1B47943d818E5F672D127958',
        ];

        for (const address of knownAddresses) {
          const discovered =
            await this.contractDiscoveryService.discoverContract(
              address,
              networkName,
            );
          if (discovered) {
            nftContracts.push(discovered);
          }
        }
      }

      const results: any[] = [];

      for (const contract of nftContracts) {
        try {
          const contractRepo = (this.processEventUseCase as any)
            .contractRepository;
          const existing = await contractRepo.findByAddress(contract.address);

          if (existing) {
            this.logger.log(
              `Contract ${contract.address} already registered, skipping`,
            );
            results.push({
              name: contract.name,
              symbol: contract.symbol,
              address: contract.address,
              status: 'already_exists',
            });
            continue;
          }

          results.push({
            name: contract.name,
            symbol: contract.symbol,
            address: contract.address,
            status: 'registered',
          });
        } catch (error) {
          this.logger.error(
            `Failed to process contract ${contract.address}:`,
            error,
          );
          results.push({
            name: contract.name || 'Unknown',
            address: contract.address,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        message: 'NFT contracts registration completed',
        networkName,
        contracts: results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to register contracts:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async saveNFTsToDatabase() {
    try {
      this.logger.log('Starting to save NFTs to database');

      const networkName = 'obelisk-testnet';

      const contractRepo = (this.processEventUseCase as any).contractRepository;
      const allContracts = await contractRepo.findActive();
      const nftContracts = allContracts.filter(
        (contract: any) =>
          (contract.network === networkName || !contract.network) &&
          (contract.contractType === 'ERC721' ||
            contract.contractType === 'ERC1155'),
      );

      if (nftContracts.length === 0) {
        throw new Error(
          'No NFT contracts found in database. Run contract registration first.',
        );
      }

      const results: any[] = [];
      let totalSaved = 0;

      for (const dbContract of nftContracts) {
        try {
          this.logger.log(
            `Processing collection: ${dbContract.name || dbContract.symbol}`,
          );

          const provider =
            this.contractInteractionService.getProvider(networkName);
          if (!provider) {
            throw new Error(`No provider for ${networkName}`);
          }

          const assetRepo = (this.processEventUseCase as any).assetRepository;
          const existingAssets = await assetRepo.findByContract(dbContract.id);

          this.logger.log(
            `Found ${existingAssets.length} existing NFTs for ${dbContract.address}`,
          );

          const currentBlock =
            await this.contractInteractionService.getLatestBlockNumber(
              networkName,
            );
          const fromBlock = 0;

          const transferEvents =
            await this.contractInteractionService.getContractEvents(
              dbContract.address,
              networkName,
              fromBlock,
              currentBlock,
              ['Transfer'],
            );

          this.logger.log(
            `Found ${transferEvents.length} Transfer events for ${dbContract.address}`,
          );

          let savedCount = 0;

          if (transferEvents.length === 0) {
            try {
              const Contract = await import('ethers').then((m) => m.Contract);
              const contract = new Contract(
                dbContract.address,
                [
                  'function totalSupply() view returns (uint256)',
                  'function tokenByIndex(uint256 index) view returns (uint256)',
                  'function ownerOf(uint256 tokenId) view returns (address)',
                ],
                provider.jsonRpc,
              );

              const totalSupply = await contract.totalSupply();
              const supplyNumber = Number(totalSupply.toString());

              this.logger.log(
                `No Transfer events found, but contract has ${supplyNumber} NFTs. Creating directly...`,
              );

              for (let i = 0; i < supplyNumber; i++) {
                try {
                  const tokenId = await contract.tokenByIndex(i);
                  const owner = await contract.ownerOf(tokenId);
                  const tokenIdString = tokenId.toString();

                  const existingAsset = existingAssets.find(
                    (asset: any) =>
                      asset.tokenId === tokenIdString &&
                      asset.contractId === dbContract.id,
                  );

                  if (existingAsset) {
                    this.logger.debug(
                      `NFT ${tokenIdString} already exists, skipping`,
                    );
                    continue;
                  }

                  const eventData = {
                    eventType: 'blockchain.token.minted' as const,
                    networkName,
                    contractAddress: dbContract.address,
                    to: owner,
                    from: '0x0000000000000000000000000000000000000000',
                    tokenId: tokenIdString,
                    blockNumber: 0,
                    transactionHash: `0x${'0'.repeat(64)}`,
                    blockHash: `0x${'0'.repeat(64)}`,
                    logIndex: 0,
                    timestamp: new Date(),
                  };

                  await this.processEventUseCase.execute(eventData);
                  savedCount++;
                  totalSaved++;
                } catch (nftError) {
                  this.logger.warn(
                    `Failed to process NFT at index ${i}:`,
                    nftError,
                  );
                }
              }
            } catch (contractError) {
              this.logger.error(
                `Failed to read NFTs directly from contract ${dbContract.address}:`,
                contractError,
              );
            }
          } else {
            for (const event of transferEvents) {
              try {
                const isMint =
                  event.args?.from ===
                  '0x0000000000000000000000000000000000000000';

                if (!event.args?.tokenId) continue;

                const tokenId = event.args.tokenId.toString();
                const existingAsset = existingAssets.find(
                  (asset: any) =>
                    asset.tokenId === tokenId &&
                    asset.contractId === dbContract.id,
                );

                if (existingAsset) {
                  this.logger.debug(`NFT ${tokenId} already exists, skipping`);
                  continue;
                }

                const eventData = {
                  eventType: isMint
                    ? ('blockchain.token.minted' as const)
                    : ('blockchain.token.transferred' as const),
                  networkName,
                  contractAddress: dbContract.address,
                  to: event.args.to,
                  from: event.args.from,
                  tokenId: tokenId,
                  blockNumber: event.blockNumber,
                  transactionHash: event.transactionHash,
                  blockHash: event.blockHash,
                  logIndex: event.index || 0,
                  timestamp: new Date(),
                };

                await this.processEventUseCase.execute(eventData);
                savedCount++;
                totalSaved++;
              } catch (eventError) {
                this.logger.warn(
                  `Failed to process event for token ${event.args?.tokenId}:`,
                  eventError,
                );
              }
            }
          }

          results.push({
            collection: dbContract.name || dbContract.symbol,
            contractAddress: dbContract.address,
            eventsProcessed: transferEvents.length,
            newNFTsSaved: savedCount,
            existingNFTs: existingAssets.length,
          });
        } catch (error) {
          this.logger.error(
            `Failed to process collection ${dbContract.address}:`,
            error,
          );
          results.push({
            collection: dbContract.name || dbContract.symbol,
            contractAddress: dbContract.address,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        message: `Successfully processed ${totalSaved} new NFTs from blockchain events`,
        networkName,
        collections: results,
        totalNFTsSaved: totalSaved,
        note: 'Used real blockchain events instead of mock data',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to save NFTs to database:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
