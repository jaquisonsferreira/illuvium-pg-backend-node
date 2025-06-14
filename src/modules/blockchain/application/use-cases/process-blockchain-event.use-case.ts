import { Injectable, Inject, Logger } from '@nestjs/common';
import { BlockchainEventBridgeService } from '../../infrastructure/services/blockchain-event-bridge.service';
import {
  BlockchainEvent,
  EventProcessingResult,
  ContractDiscoveredEvent,
  TokenTransferredEvent,
  TokenMintedEvent,
  TokenBurnedEvent,
  EthTransferredEvent,
} from '../../domain/types/blockchain-event.types';
import { ProcessBlockchainEventForAuditUseCase } from '../../../audit/application/use-cases/process-blockchain-event-for-audit.use-case';
import { BlockchainContractRepositoryInterface } from '../../../assets/domain/repositories/blockchain-contract.repository.interface';
import { BlockchainAssetRepositoryInterface } from '../../../assets/domain/repositories/blockchain-asset.repository.interface';
import { AssetTransactionRepositoryInterface } from '../../../assets/domain/repositories/asset-transaction.repository.interface';
import { BlockchainContract } from '../../../assets/domain/entities/blockchain-contract.entity';
import { BlockchainAsset } from '../../../assets/domain/entities/blockchain-asset.entity';
import {
  AssetTransaction,
  TransactionEventType,
} from '../../../assets/domain/entities/asset-transaction.entity';
import {
  BLOCKCHAIN_CONTRACT_REPOSITORY,
  BLOCKCHAIN_ASSET_REPOSITORY,
  ASSET_TRANSACTION_REPOSITORY,
} from '../../../assets/constants';

export interface EventProcessingOptions {
  updateDatabase?: boolean;
  skipDuplicates?: boolean;
}

@Injectable()
export class ProcessBlockchainEventUseCase {
  private readonly logger = new Logger(ProcessBlockchainEventUseCase.name);

  constructor(
    private readonly eventBridgeService: BlockchainEventBridgeService,
    @Inject(BLOCKCHAIN_CONTRACT_REPOSITORY)
    private readonly contractRepository: BlockchainContractRepositoryInterface,
    @Inject(BLOCKCHAIN_ASSET_REPOSITORY)
    private readonly assetRepository: BlockchainAssetRepositoryInterface,
    @Inject(ASSET_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: AssetTransactionRepositoryInterface,
    private readonly auditUseCase: ProcessBlockchainEventForAuditUseCase,
  ) {}

  async execute(event: BlockchainEvent): Promise<EventProcessingResult> {
    try {
      this.logger.debug(`Processing event: ${event.eventType}`);

      await this.updateDatabase(event);

      await this.auditUseCase.execute(event);

      const result = await this.eventBridgeService.publishEvent(event);

      if (result.success) {
        this.logger.log(
          `Successfully processed and published event: ${event.eventType}`,
        );
      } else {
        this.logger.warn(
          `Failed to publish event: ${event.eventType} - ${result.error}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Error processing event: ${event.eventType}`, error);
      return {
        success: false,
        eventId: 'failed',
        eventType: event.eventType,
        processedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async executeBatch(
    events: BlockchainEvent[],
  ): Promise<EventProcessingResult[]> {
    try {
      this.logger.debug(`Processing ${events.length} events`);

      for (const event of events) {
        await this.updateDatabase(event);
      }

      const results = await this.eventBridgeService.publishEvents(events);

      const successCount = results.filter((r) => r.success).length;
      this.logger.log(
        `Batch processed: ${successCount}/${events.length} events published successfully`,
      );

      return results;
    } catch (error) {
      this.logger.error('Error processing event batch', error);
      return events.map((event) => ({
        success: false,
        eventId: 'failed',
        eventType: event.eventType,
        processedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  private async updateDatabase(event: BlockchainEvent): Promise<void> {
    switch (event.eventType) {
      case 'blockchain.contract.discovered':
        await this.handleContractDiscovered(event);
        break;

      case 'blockchain.token.transferred':
        await this.handleTokenTransfer(event);
        break;

      case 'blockchain.token.minted':
        await this.handleTokenMint(event);
        break;

      case 'blockchain.token.burned':
        await this.handleTokenBurn(event);
        break;

      case 'blockchain.eth.transferred':
        await this.handleEthTransfer(event);
        break;

      default:
        this.logger.debug(
          `No database handler for event type: ${event.eventType}`,
        );
    }
  }

  private async handleContractDiscovered(
    event: ContractDiscoveredEvent,
  ): Promise<void> {
    try {
      const existingContract = await this.contractRepository.findByAddress(
        event.contractAddress,
      );

      if (!existingContract) {
        const contract = new BlockchainContract({
          address: event.contractAddress,
          contractType: event.contractType,
          name: event.name || 'Unknown',
          symbol: event.symbol || 'UNKNOWN',
          decimals: event.decimals,
          network: event.networkName,
          isActive: true,
        });

        await this.contractRepository.create(contract);
        this.logger.log(`Created new contract: ${event.contractAddress}`);
      } else {
        this.logger.debug(`Contract already exists: ${event.contractAddress}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle contract discovery: ${event.contractAddress}`,
        error,
      );
    }
  }

  private async handleTokenTransfer(
    event: TokenTransferredEvent,
  ): Promise<void> {
    try {
      const contract = await this.contractRepository.findByAddress(
        event.contractAddress,
      );
      if (!contract) {
        this.logger.warn(
          `Contract not found for transfer: ${event.contractAddress}`,
        );
        return;
      }

      if (event.from === '0x0000000000000000000000000000000000000000') {
        await this.handleTokenMint({
          ...event,
          eventType: 'blockchain.token.minted',
          to: event.to,
        } as TokenMintedEvent);
        return;
      }

      if (event.to === '0x0000000000000000000000000000000000000000') {
        await this.handleTokenBurn({
          ...event,
          eventType: 'blockchain.token.burned',
          from: event.from,
        } as TokenBurnedEvent);
        return;
      }

      await this.updateAssetOwnership(
        contract.id,
        event.tokenId,
        event.to,
        event.blockNumber.toString(),
      );

      if (contract.contractType === 'ERC1155' && event.amount) {
        await this.updateAssetBalance(
          contract.id,
          event.tokenId,
          event.to,
          event.amount,
          event.blockNumber.toString(),
        );
      }

      const asset = await this.assetRepository.findByContractAndToken(
        contract.id,
        event.tokenId,
      );
      if (asset) {
        await this.recordTransaction(event, asset.id);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle token transfer: ${event.transactionHash}`,
        error,
      );
    }
  }

  private async handleTokenMint(event: TokenMintedEvent): Promise<void> {
    try {
      const contract = await this.contractRepository.findByAddress(
        event.contractAddress,
      );
      if (!contract) {
        this.logger.warn(
          `Contract not found for mint: ${event.contractAddress}`,
        );
        return;
      }

      let asset = await this.assetRepository.findByContractAndToken(
        contract.id,
        event.tokenId,
      );

      if (!asset) {
        asset = new BlockchainAsset({
          contractId: contract.id,
          tokenId: event.tokenId,
          ownerAddress: event.to,
          balance: event.amount || '1',
          lastUpdatedBlock: event.blockNumber.toString(),
        });

        asset = await this.assetRepository.create(asset);
        this.logger.log(
          `Created new asset: ${contract.address}:${event.tokenId}`,
        );
      } else {
        const newBalance =
          contract.contractType === 'ERC1155' && event.amount
            ? (BigInt(asset.balance) + BigInt(event.amount)).toString()
            : asset.balance;

        await this.assetRepository.update(asset.id, {
          ownerAddress: event.to,
          balance: newBalance,
          lastUpdatedBlock: event.blockNumber.toString(),
        });

        this.logger.log(`Updated asset: ${contract.address}:${event.tokenId}`);
      }

      await this.recordTransaction(event, asset.id);
    } catch (error) {
      this.logger.error(
        `Failed to handle token mint: ${event.transactionHash}`,
        error,
      );
    }
  }

  private async handleTokenBurn(event: TokenBurnedEvent): Promise<void> {
    try {
      const contract = await this.contractRepository.findByAddress(
        event.contractAddress,
      );
      if (!contract) {
        this.logger.warn(
          `Contract not found for burn: ${event.contractAddress}`,
        );
        return;
      }

      const asset = await this.assetRepository.findByContractAndToken(
        contract.id,
        event.tokenId,
      );

      if (asset) {
        await this.recordTransaction(event, asset.id);
        if (contract.contractType === 'ERC1155' && event.amount) {
          const newBalance = (
            BigInt(asset.balance) - BigInt(event.amount)
          ).toString();

          if (BigInt(newBalance) <= 0n) {
            await this.assetRepository.delete(asset.id);
            this.logger.log(
              `Deleted burned asset: ${contract.address}:${event.tokenId}`,
            );
          } else {
            await this.assetRepository.update(asset.id, {
              balance: newBalance,
              lastUpdatedBlock: event.blockNumber.toString(),
            });
            this.logger.log(
              `Updated burned asset balance: ${contract.address}:${event.tokenId}`,
            );
          }
        } else {
          await this.assetRepository.delete(asset.id);
          this.logger.log(
            `Deleted burned asset: ${contract.address}:${event.tokenId}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle token burn: ${event.transactionHash}`,
        error,
      );
    }
  }

  private async handleEthTransfer(event: EthTransferredEvent): Promise<void> {
    try {
      const transaction = new AssetTransaction({
        assetId: 'eth-transfer',
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber.toString(),
        eventType: TransactionEventType.TRANSFER,
        fromAddress: event.from,
        toAddress: event.to,
        value: event.value,
        timestamp: event.timestamp,
      });

      await this.transactionRepository.create(transaction);
      this.logger.debug(`Recorded ETH transfer: ${event.transactionHash}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle ETH transfer: ${event.transactionHash}`,
        error,
      );
    }
  }

  private async updateAssetOwnership(
    contractId: string,
    tokenId: string,
    newOwner: string,
    blockNumber: string,
  ): Promise<void> {
    const asset = await this.assetRepository.findByContractAndToken(
      contractId,
      tokenId,
    );

    if (asset) {
      await this.assetRepository.update(asset.id, {
        ownerAddress: newOwner,
        lastUpdatedBlock: blockNumber,
      });
    }
  }

  private async updateAssetBalance(
    contractId: string,
    tokenId: string,
    owner: string,
    newBalance: string,
    blockNumber: string,
  ): Promise<void> {
    const asset = await this.assetRepository.findByContractAndToken(
      contractId,
      tokenId,
    );

    if (asset) {
      await this.assetRepository.update(asset.id, {
        balance: newBalance,
        lastUpdatedBlock: blockNumber,
      });
    }
  }

  private async recordTransaction(
    event: BlockchainEvent & { contractAddress: string },
    assetId: string,
  ): Promise<void> {
    try {
      const eventTypeMap = {
        'blockchain.token.transferred': TransactionEventType.TRANSFER,
        'blockchain.token.minted': TransactionEventType.MINT,
        'blockchain.token.burned': TransactionEventType.BURN,
      } as const;

      const transactionEventType =
        eventTypeMap[event.eventType as keyof typeof eventTypeMap];
      if (!transactionEventType) return;

      const transaction = new AssetTransaction({
        assetId: assetId,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber.toString(),
        eventType: transactionEventType,
        fromAddress: 'from' in event ? (event as any).from : '',
        toAddress: 'to' in event ? (event as any).to : '',
        value: 'amount' in event ? (event as any).amount : '1',
        timestamp: event.timestamp,
      });

      await this.transactionRepository.create(transaction);
      this.logger.debug(`Recorded transaction: ${event.transactionHash}`);
    } catch (error) {
      this.logger.error(
        `Failed to record transaction: ${event.transactionHash}`,
        error,
      );
    }
  }
}
