import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventListenerService } from '../services/event-listener.service';
import { BlockProcessingJob } from '../../domain/types/blockchain-event.types';
import { BLOCKCHAIN_QUEUES } from '../../constants';

@Processor(BLOCKCHAIN_QUEUES.BLOCK_PROCESSOR)
export class BlockProcessorJobProcessor {
  private readonly logger = new Logger(BlockProcessorJobProcessor.name);

  constructor(private readonly eventListenerService: EventListenerService) {}

  @Process('process-block')
  async handleBlockProcessing(job: Job<BlockProcessingJob>) {
    const { data } = job;
    const { networkName, blockNumber } = data;

    try {
      this.logger.debug(
        `Starting block processing job: ${networkName} block ${blockNumber}`,
      );

      await job.progress(10);

      await this.eventListenerService.processBlock(data);

      await job.progress(100);

      this.logger.log(
        `Completed block processing: ${networkName} block ${blockNumber}`,
      );

      return {
        success: true,
        networkName,
        blockNumber,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to process block ${blockNumber} on ${networkName}:`,
        error,
      );

      throw error;
    }
  }

  @Process('process-block-range')
  async handleBlockRangeProcessing(
    job: Job<{ networkName: string; fromBlock: number; toBlock: number }>,
  ) {
    const { data } = job;
    const { networkName, fromBlock, toBlock } = data;

    try {
      this.logger.log(
        `Starting block range processing: ${networkName} blocks ${fromBlock}-${toBlock}`,
      );

      const totalBlocks = toBlock - fromBlock + 1;
      let processedBlocks = 0;

      for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
        const progress = Math.round((processedBlocks / totalBlocks) * 100);
        await job.progress(progress);

        const blockJob: BlockProcessingJob = {
          networkName,
          blockNumber,
        };

        await this.eventListenerService.processBlock(blockJob);

        processedBlocks++;

        this.logger.debug(
          `Processed block ${blockNumber}/${toBlock} (${progress}%)`,
        );

        if (blockNumber < toBlock) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      await job.progress(100);

      this.logger.log(
        `Completed block range processing: ${networkName} blocks ${fromBlock}-${toBlock}`,
      );

      return {
        success: true,
        networkName,
        fromBlock,
        toBlock,
        totalBlocks,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to process block range ${fromBlock}-${toBlock} on ${networkName}:`,
        error,
      );

      throw error;
    }
  }
}
