import { Injectable, Logger } from '@nestjs/common';
import {
  CreateUserAuditLogUseCase,
  CreateUserAuditLogRequest,
} from './create-user-audit-log.use-case';
import {
  CreateDeveloperAuditLogUseCase,
  CreateDeveloperAuditLogRequest,
} from './create-developer-audit-log.use-case';
import {
  UserAuditEventType,
  DeveloperAuditEventType,
} from '../../domain/types/audit-event.types';
import { BlockchainEvent } from '../../../blockchain/domain/types/blockchain-event.types';

export interface ProcessAuditEventResponse {
  success: boolean;
  userAuditCreated: boolean;
  developerAuditCreated: boolean;
  message: string;
}

@Injectable()
export class ProcessBlockchainEventForAuditUseCase {
  private readonly logger = new Logger(
    ProcessBlockchainEventForAuditUseCase.name,
  );

  constructor(
    private readonly createUserAuditLogUseCase: CreateUserAuditLogUseCase,
    private readonly createDeveloperAuditLogUseCase: CreateDeveloperAuditLogUseCase,
  ) {}

  async execute(event: BlockchainEvent): Promise<ProcessAuditEventResponse> {
    try {
      this.logger.debug(
        `Processing blockchain event for audit: ${event.eventType}`,
      );

      let userAuditCreated = false;
      let developerAuditCreated = false;

      const userAuditRequest = this.mapToUserAuditRequest(event);
      if (userAuditRequest) {
        const userResult =
          await this.createUserAuditLogUseCase.execute(userAuditRequest);
        userAuditCreated = userResult.success;

        if (!userResult.success) {
          this.logger.warn(
            `Failed to create user audit log: ${userResult.message}`,
          );
        }
      }

      const developerAuditRequest = this.mapToDeveloperAuditRequest(event);
      if (developerAuditRequest) {
        const devResult = await this.createDeveloperAuditLogUseCase.execute(
          developerAuditRequest,
        );
        developerAuditCreated = devResult.success;

        if (!devResult.success) {
          this.logger.warn(
            `Failed to create developer audit log: ${devResult.message}`,
          );
        }
      }

      return {
        success: true,
        userAuditCreated,
        developerAuditCreated,
        message: 'Blockchain event processed for audit',
      };
    } catch (error) {
      this.logger.error('Failed to process blockchain event for audit', {
        error: error.message,
        eventType: event.eventType,
        transactionHash: event.transactionHash,
      });

      return {
        success: false,
        userAuditCreated: false,
        developerAuditCreated: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private mapToUserAuditRequest(
    event: BlockchainEvent,
  ): CreateUserAuditLogRequest | null {
    switch (event.eventType) {
      case 'blockchain.token.minted': {
        const mintEvent = event;
        return {
          userAddress: mintEvent.to,
          eventType: UserAuditEventType.TOKEN_MINTED,
          contractAddress: mintEvent.contractAddress,
          tokenId: mintEvent.tokenId,
          networkName: mintEvent.networkName,
          blockNumber: mintEvent.blockNumber,
          transactionHash: mintEvent.transactionHash,
          amount: mintEvent.amount,
          toAddress: mintEvent.to,
          timestamp: mintEvent.timestamp,
          metadata: {
            blockHash: mintEvent.blockHash,
            logIndex: mintEvent.logIndex,
          },
        };
      }

      case 'blockchain.token.transferred': {
        const transferEvent = event;
        if (
          transferEvent.from === '0x0000000000000000000000000000000000000000'
        ) {
          return null;
        }

        if (transferEvent.to === '0x0000000000000000000000000000000000000000') {
          return null;
        }

        return {
          userAddress: transferEvent.to,
          eventType: UserAuditEventType.TOKEN_TRANSFERRED,
          contractAddress: transferEvent.contractAddress,
          tokenId: transferEvent.tokenId,
          networkName: transferEvent.networkName,
          blockNumber: transferEvent.blockNumber,
          transactionHash: transferEvent.transactionHash,
          amount: transferEvent.amount,
          fromAddress: transferEvent.from,
          toAddress: transferEvent.to,
          timestamp: transferEvent.timestamp,
          metadata: {
            blockHash: transferEvent.blockHash,
            logIndex: transferEvent.logIndex,
          },
        };
      }

      case 'blockchain.token.burned': {
        const burnEvent = event;
        return {
          userAddress: burnEvent.from,
          eventType: UserAuditEventType.TOKEN_BURNED,
          contractAddress: burnEvent.contractAddress,
          tokenId: burnEvent.tokenId,
          networkName: burnEvent.networkName,
          blockNumber: burnEvent.blockNumber,
          transactionHash: burnEvent.transactionHash,
          amount: burnEvent.amount,
          fromAddress: burnEvent.from,
          timestamp: burnEvent.timestamp,
          metadata: {
            blockHash: burnEvent.blockHash,
            logIndex: burnEvent.logIndex,
          },
        };
      }

      default:
        return null;
    }
  }

  private mapToDeveloperAuditRequest(
    event: BlockchainEvent,
  ): CreateDeveloperAuditLogRequest | null {
    switch (event.eventType) {
      case 'blockchain.contract.paused': {
        const pauseEvent = event;
        return {
          eventType: DeveloperAuditEventType.CONTRACT_PAUSED,
          contractAddress: pauseEvent.contractAddress,
          actorAddress: pauseEvent.account,
          networkName: pauseEvent.networkName,
          blockNumber: pauseEvent.blockNumber,
          transactionHash: pauseEvent.transactionHash,
          newValue: 'paused',
          timestamp: pauseEvent.timestamp,
          metadata: {
            blockHash: pauseEvent.blockHash,
            logIndex: pauseEvent.logIndex,
          },
        };
      }

      case 'blockchain.contract.unpaused': {
        const unpauseEvent = event;
        return {
          eventType: DeveloperAuditEventType.CONTRACT_UNPAUSED,
          contractAddress: unpauseEvent.contractAddress,
          actorAddress: unpauseEvent.account,
          networkName: unpauseEvent.networkName,
          blockNumber: unpauseEvent.blockNumber,
          transactionHash: unpauseEvent.transactionHash,
          newValue: 'unpaused',
          timestamp: unpauseEvent.timestamp,
          metadata: {
            blockHash: unpauseEvent.blockHash,
            logIndex: unpauseEvent.logIndex,
          },
        };
      }

      case 'blockchain.contract.ownership_transferred': {
        const ownershipEvent = event;
        return {
          eventType: DeveloperAuditEventType.CONTRACT_OWNERSHIP_TRANSFERRED,
          contractAddress: ownershipEvent.contractAddress,
          actorAddress: ownershipEvent.newOwner,
          networkName: ownershipEvent.networkName,
          blockNumber: ownershipEvent.blockNumber,
          transactionHash: ownershipEvent.transactionHash,
          previousValue: ownershipEvent.previousOwner,
          newValue: ownershipEvent.newOwner,
          timestamp: ownershipEvent.timestamp,
          metadata: {
            blockHash: ownershipEvent.blockHash,
            logIndex: ownershipEvent.logIndex,
          },
        };
      }

      default:
        return null;
    }
  }
}
