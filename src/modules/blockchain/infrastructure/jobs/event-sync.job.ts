import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventListenerService } from '../services/event-listener.service';
import { EventSyncJob } from '../../domain/types/blockchain-event.types';
import { BLOCKCHAIN_QUEUES } from '../../constants';

@Processor(BLOCKCHAIN_QUEUES.EVENT_SYNC)
export class EventSyncJobProcessor {
  private readonly logger = new Logger(EventSyncJobProcessor.name);

  constructor(private readonly eventListenerService: EventListenerService) {}

  @Process('sync-events')
  async handleEventSync(job: Job<EventSyncJob>) {
    const { data } = job;
    const { networkName, fromBlock, toBlock, contractAddresses } = data;

    try {
      this.logger.log(
        `Starting event sync job: ${networkName} blocks ${fromBlock}-${toBlock}`,
      );

      await job.progress(10);

      await this.eventListenerService.processSyncJob(data);

      await job.progress(100);

      this.logger.log(
        `Completed event sync: ${networkName} blocks ${fromBlock}-${toBlock}`,
      );

      return {
        success: true,
        networkName,
        fromBlock,
        toBlock,
        contractAddresses: contractAddresses || [],
        totalBlocks: toBlock - fromBlock + 1,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to sync events for ${networkName} blocks ${fromBlock}-${toBlock}:`,
        error,
      );

      throw error;
    }
  }

  @Process('sync-contract-events')
  async handleContractEventSync(
    job: Job<{
      networkName: string;
      contractAddress: string;
      fromBlock: number;
      toBlock: number;
      eventNames?: string[];
    }>,
  ) {
    const { data } = job;
    const { networkName, contractAddress, fromBlock, toBlock, eventNames } =
      data;

    try {
      this.logger.log(
        `Starting contract event sync: ${contractAddress} on ${networkName} blocks ${fromBlock}-${toBlock}`,
      );

      await job.progress(10);

      const syncJob: EventSyncJob = {
        networkName,
        fromBlock,
        toBlock,
        contractAddresses: [contractAddress],
      };

      await this.eventListenerService.processSyncJob(syncJob);

      await job.progress(100);

      this.logger.log(
        `Completed contract event sync: ${contractAddress} on ${networkName}`,
      );

      return {
        success: true,
        networkName,
        contractAddress,
        fromBlock,
        toBlock,
        eventNames: eventNames || [],
        totalBlocks: toBlock - fromBlock + 1,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to sync contract events for ${contractAddress} on ${networkName}:`,
        error,
      );

      throw error;
    }
  }

  @Process('backfill-events')
  async handleEventBackfill(
    job: Job<{
      networkName: string;
      targetBlock: number;
      lookbackBlocks?: number;
      contractAddresses?: string[];
    }>,
  ) {
    const { data } = job;
    const {
      networkName,
      targetBlock,
      lookbackBlocks = 1000,
      contractAddresses,
    } = data;

    try {
      const fromBlock = Math.max(0, targetBlock - lookbackBlocks);
      const toBlock = targetBlock;

      this.logger.log(
        `Starting event backfill: ${networkName} blocks ${fromBlock}-${toBlock}`,
      );

      await job.progress(10);

      const chunkSize = 100;
      const totalChunks = Math.ceil((toBlock - fromBlock + 1) / chunkSize);
      let processedChunks = 0;

      for (
        let chunkStart = fromBlock;
        chunkStart <= toBlock;
        chunkStart += chunkSize
      ) {
        const chunkEnd = Math.min(chunkStart + chunkSize - 1, toBlock);

        const syncJob: EventSyncJob = {
          networkName,
          fromBlock: chunkStart,
          toBlock: chunkEnd,
          contractAddresses,
        };

        await this.eventListenerService.processSyncJob(syncJob);

        processedChunks++;
        const progress = Math.round((processedChunks / totalChunks) * 90) + 10;
        await job.progress(progress);

        this.logger.debug(
          `Backfill progress: ${processedChunks}/${totalChunks} chunks (${progress}%)`,
        );

        if (chunkStart < toBlock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      await job.progress(100);

      this.logger.log(
        `Completed event backfill: ${networkName} blocks ${fromBlock}-${toBlock}`,
      );

      return {
        success: true,
        networkName,
        fromBlock,
        toBlock,
        lookbackBlocks,
        contractAddresses: contractAddresses || [],
        totalBlocks: toBlock - fromBlock + 1,
        totalChunks,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to backfill events for ${networkName}:`, error);

      throw error;
    }
  }
}
