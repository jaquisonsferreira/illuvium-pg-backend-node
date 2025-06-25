/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ContractInteractionService } from './contract-interaction.service';
import { BlockchainEventBridgeService } from './blockchain-event-bridge.service';
import {
  BlockchainEvent,
  EthTransferredEvent,
  TokenTransferredEvent,
  TokenApprovalEvent,
  TokenApprovalForAllEvent,
  ContractPausedEvent,
  ContractUnpausedEvent,
  ContractOwnershipTransferredEvent,
  ContractDiscoveredEvent,
  BlockProcessingJob,
  EventSyncJob,
} from '../../domain/types/blockchain-event.types';
import {
  BLOCKCHAIN_QUEUES,
  BLOCKCHAIN_EVENT_TYPES,
  SUPPORTED_NETWORKS,
  BLOCK_SYNC_INTERVALS,
} from '../../constants';

@Injectable()
export class EventListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventListenerService.name);
  private blockProcessingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastProcessedBlocks: Map<string, number> = new Map();

  constructor(
    private readonly contractService: ContractInteractionService,
    private readonly eventBridgeService: BlockchainEventBridgeService,
    @InjectQueue(BLOCKCHAIN_QUEUES.BLOCK_PROCESSOR)
    private readonly blockProcessorQueue: Queue<BlockProcessingJob>,
    @InjectQueue(BLOCKCHAIN_QUEUES.EVENT_SYNC)
    private readonly eventSyncQueue: Queue<EventSyncJob>,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Event Listener Service...');

    const connectivityResults = await this.contractService.testConnectivity();
    const eventBridgeConnected = await this.eventBridgeService.testConnection();

    if (!eventBridgeConnected) {
      this.logger.error(
        'EventBridge connection failed - events will not be published',
      );
    }

    for (const [networkName, isConnected] of Object.entries(
      connectivityResults,
    )) {
      if (isConnected) {
        await this.startBlockProcessing(networkName);
      } else {
        this.logger.warn(`Skipping ${networkName} - connection failed`);
      }
    }

    this.logger.log('Event Listener Service initialized');
  }

  async onModuleDestroy() {
    this.logger.log('Stopping Event Listener Service...');

    for (const [
      networkName,
      interval,
    ] of this.blockProcessingIntervals.entries()) {
      clearInterval(interval);
      this.logger.log(`Stopped block processing for ${networkName}`);
    }

    this.blockProcessingIntervals.clear();
    this.logger.log('Event Listener Service stopped');
  }

  private async startBlockProcessing(networkName: string): Promise<void> {
    try {
      const latestBlock =
        await this.contractService.getLatestBlockNumber(networkName);
      this.lastProcessedBlocks.set(networkName, latestBlock);

      const networkConfig = Object.values(SUPPORTED_NETWORKS).find(
        (n) => n.name === networkName,
      );
      const intervalKey =
        networkConfig?.name.toUpperCase() as keyof typeof BLOCK_SYNC_INTERVALS;
      const interval =
        networkConfig && intervalKey in BLOCK_SYNC_INTERVALS
          ? BLOCK_SYNC_INTERVALS[intervalKey]
          : 5000;

      const processingInterval = setInterval(async () => {
        await this.processNewBlocks(networkName);
      }, interval);

      this.blockProcessingIntervals.set(networkName, processingInterval);
      this.logger.log(
        `Started block processing for ${networkName} (interval: ${interval}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to start block processing for ${networkName}:`,
        error,
      );
    }
  }

  private async processNewBlocks(networkName: string): Promise<void> {
    try {
      const currentBlock =
        await this.contractService.getLatestBlockNumber(networkName);
      const lastProcessed =
        this.lastProcessedBlocks.get(networkName) || currentBlock;

      if (currentBlock > lastProcessed) {
        const blocksToProcess = Math.min(currentBlock - lastProcessed, 10);

        for (
          let blockNumber = lastProcessed + 1;
          blockNumber <= lastProcessed + blocksToProcess;
          blockNumber++
        ) {
          await this.blockProcessorQueue.add(
            'process-block',
            {
              networkName,
              blockNumber,
              priority: currentBlock - blockNumber,
            } as BlockProcessingJob,
            {
              priority: currentBlock - blockNumber,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
            },
          );
        }

        this.lastProcessedBlocks.set(
          networkName,
          lastProcessed + blocksToProcess,
        );
        this.logger.debug(
          `Queued ${blocksToProcess} blocks for processing on ${networkName}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing new blocks for ${networkName}:`,
        error,
      );
    }
  }

  async processBlock(job: BlockProcessingJob): Promise<void> {
    const { networkName, blockNumber } = job;

    try {
      this.logger.debug(`Processing block ${blockNumber} on ${networkName}`);

      const ethTransfers = await this.contractService.getEthTransfersFromBlock(
        networkName,
        blockNumber,
      );

      for (const transfer of ethTransfers) {
        const ethEvent: EthTransferredEvent = {
          eventType: BLOCKCHAIN_EVENT_TYPES.ETH_TRANSFERRED,
          networkName,
          blockNumber,
          transactionHash: transfer.transactionHash,
          blockHash: transfer.blockHash,
          logIndex: 0,
          timestamp: new Date(),
          from: transfer.from,
          to: transfer.to,
          value: transfer.value,
        };

        await this.publishEvent(ethEvent);
      }

      const block = await this.contractService.getBlock(
        networkName,
        blockNumber,
      );

      if (block && block.transactions) {
        await this.processContractInteractions(networkName, block);
      }

      this.logger.debug(
        `Completed processing block ${blockNumber} on ${networkName}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing block ${blockNumber} on ${networkName}:`,
        error,
      );
      throw error;
    }
  }

  private async processContractInteractions(
    networkName: string,
    block: any,
  ): Promise<void> {
    const contractAddresses = new Set<string>();

    for (const tx of block.transactions) {
      if (typeof tx === 'string') continue;
      const transaction = tx;

      if (transaction.to && transaction.data && transaction.data !== '0x') {
        contractAddresses.add(transaction.to);
      }
    }

    for (const contractAddress of contractAddresses) {
      try {
        await this.processContractEvents(
          contractAddress,
          networkName,
          block.number,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to process events for contract ${contractAddress}:`,
          error,
        );
      }
    }
  }

  private async processContractEvents(
    contractAddress: string,
    networkName: string,
    blockNumber: number,
  ): Promise<void> {
    try {
      const events = await this.contractService.getContractEvents(
        contractAddress,
        networkName,
        blockNumber,
        blockNumber,
      );

      for (const event of events) {
        const blockchainEvent = await this.convertToBlockchainEvent(
          event,
          contractAddress,
          networkName,
          blockNumber,
        );

        if (blockchainEvent) {
          await this.publishEvent(blockchainEvent);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing contract events for ${contractAddress}:`,
        error,
      );
    }
  }

  private async convertToBlockchainEvent(
    event: any,
    contractAddress: string,
    networkName: string,
    blockNumber: number,
  ): Promise<BlockchainEvent | null> {
    const baseEvent = {
      networkName,
      blockNumber,
      transactionHash: event.transactionHash,
      blockHash: event.blockHash,
      logIndex: event.logIndex,
      timestamp: new Date(),
    };

    try {
      switch (event.name) {
        case 'Transfer':
          if (event.args.length === 3 && event.args[2].toString().length < 10) {
            return {
              ...baseEvent,
              eventType: BLOCKCHAIN_EVENT_TYPES.TOKEN_TRANSFERRED,
              contractAddress,
              from: event.args[0],
              to: event.args[1],
              tokenId: event.args[2].toString(),
            } as TokenTransferredEvent;
          } else if (event.args.length === 3) {
            return null;
          }
          break;

        case 'TransferSingle':
          return {
            ...baseEvent,
            eventType: BLOCKCHAIN_EVENT_TYPES.TOKEN_TRANSFERRED,
            contractAddress,
            from: event.args[1],
            to: event.args[2],
            tokenId: event.args[3].toString(),
            amount: event.args[4].toString(),
          } as TokenTransferredEvent;

        case 'Approval':
          if (event.args.length === 3) {
            return {
              ...baseEvent,
              eventType: BLOCKCHAIN_EVENT_TYPES.TOKEN_APPROVAL,
              contractAddress,
              owner: event.args[0],
              approved: event.args[1],
              tokenId: event.args[2].toString(),
            } as TokenApprovalEvent;
          }
          break;

        case 'ApprovalForAll':
          return {
            ...baseEvent,
            eventType: BLOCKCHAIN_EVENT_TYPES.TOKEN_APPROVAL_FOR_ALL,
            contractAddress,
            owner: event.args[0],
            operator: event.args[1],
            approved: event.args[2],
          } as TokenApprovalForAllEvent;

        case 'Paused':
          return {
            ...baseEvent,
            eventType: BLOCKCHAIN_EVENT_TYPES.CONTRACT_PAUSED,
            contractAddress,
            account: event.args[0],
          } as ContractPausedEvent;

        case 'Unpaused':
          return {
            ...baseEvent,
            eventType: BLOCKCHAIN_EVENT_TYPES.CONTRACT_UNPAUSED,
            contractAddress,
            account: event.args[0],
          } as ContractUnpausedEvent;

        case 'OwnershipTransferred':
          return {
            ...baseEvent,
            eventType: BLOCKCHAIN_EVENT_TYPES.CONTRACT_OWNERSHIP_TRANSFERRED,
            contractAddress,
            previousOwner: event.args[0],
            newOwner: event.args[1],
          } as ContractOwnershipTransferredEvent;

        default:
          this.logger.debug(`Unhandled event type: ${event.name}`);
          return null;
      }
    } catch (error) {
      this.logger.error(`Error converting event ${event.name}:`, error);
      return null;
    }

    return null;
  }

  private async publishEvent(event: BlockchainEvent): Promise<void> {
    try {
      await this.eventBridgeService.publishEvent(event);
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.eventType}:`, error);
    }
  }

  async syncEvents(
    networkName: string,
    fromBlock: number,
    toBlock: number,
    contractAddresses?: string[],
  ): Promise<void> {
    this.logger.log(
      `Starting manual sync for ${networkName} blocks ${fromBlock}-${toBlock}`,
    );

    const job: EventSyncJob = {
      networkName,
      fromBlock,
      toBlock,
      contractAddresses,
    };

    await this.eventSyncQueue.add('sync-events', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async processSyncJob(job: EventSyncJob): Promise<void> {
    const { networkName, fromBlock, toBlock } = job;

    try {
      this.logger.log(
        `Processing sync job: ${networkName} blocks ${fromBlock}-${toBlock}`,
      );

      for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
        await this.processBlock({ networkName, blockNumber });
      }

      this.logger.log(
        `Completed sync job: ${networkName} blocks ${fromBlock}-${toBlock}`,
      );
    } catch (error) {
      this.logger.error(`Error in sync job:`, error);
      throw error;
    }
  }

  getProcessingStatus(): Record<
    string,
    { lastProcessedBlock: number; isActive: boolean }
  > {
    const status: Record<
      string,
      { lastProcessedBlock: number; isActive: boolean }
    > = {};

    for (const [networkName, lastBlock] of this.lastProcessedBlocks.entries()) {
      status[networkName] = {
        lastProcessedBlock: lastBlock,
        isActive: this.blockProcessingIntervals.has(networkName),
      };
    }

    return status;
  }

  async startListening(networkName: string): Promise<boolean> {
    try {
      if (this.blockProcessingIntervals.has(networkName)) {
        this.logger.warn(`Already listening to ${networkName}`);
        return true;
      }

      const isConnected = await this.contractService.testConnectivity();
      if (!isConnected[networkName]) {
        throw new Error(`Cannot connect to ${networkName}`);
      }

      await this.startBlockProcessing(networkName);
      this.logger.log(`Started listening to ${networkName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to start listening to ${networkName}:`, error);
      return false;
    }
  }

  async stopListening(networkName: string): Promise<boolean> {
    try {
      const interval = this.blockProcessingIntervals.get(networkName);
      if (!interval) {
        this.logger.warn(`Not currently listening to ${networkName}`);
        return true;
      }

      clearInterval(interval);
      this.blockProcessingIntervals.delete(networkName);
      this.logger.log(`Stopped listening to ${networkName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop listening to ${networkName}:`, error);
      return false;
    }
  }

  async discoverContract(
    contractAddress: string,
    networkName: string,
  ): Promise<void> {
    try {
      const contractInfo = await this.contractService.detectContractType(
        contractAddress,
        networkName,
      );

      const discoveryEvent: ContractDiscoveredEvent = {
        eventType: BLOCKCHAIN_EVENT_TYPES.CONTRACT_DISCOVERED,
        networkName,
        blockNumber:
          await this.contractService.getLatestBlockNumber(networkName),
        transactionHash: '0x0',
        blockHash: '0x0',
        logIndex: 0,
        timestamp: new Date(),
        contractAddress,
        contractType:
          contractInfo.type === 'Unknown' ? 'ERC721' : contractInfo.type,
        name: contractInfo.name,
        symbol: contractInfo.symbol,
        decimals: contractInfo.decimals,
      };

      await this.publishEvent(discoveryEvent);
      this.logger.log(
        `Discovered contract: ${contractInfo.type} at ${contractAddress}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to discover contract ${contractAddress}:`,
        error,
      );
    }
  }
}
