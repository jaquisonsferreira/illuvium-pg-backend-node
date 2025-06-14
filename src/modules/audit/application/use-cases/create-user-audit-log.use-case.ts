import { Injectable, Inject, Logger } from '@nestjs/common';
import { UserAuditLog } from '../../domain/entities/user-audit-log.entity';
import { UserAuditLogRepositoryInterface } from '../../domain/repositories/user-audit-log.repository.interface';
import { UserAuditEventType } from '../../domain/types/audit-event.types';
import { USER_AUDIT_LOG_REPOSITORY } from '../../constants';

export interface CreateUserAuditLogRequest {
  userAddress: string;
  eventType: UserAuditEventType;
  contractAddress: string;
  tokenId: string;
  networkName: string;
  blockNumber: number;
  transactionHash: string;
  amount?: string;
  fromAddress?: string;
  toAddress?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CreateUserAuditLogResponse {
  success: boolean;
  auditLogId?: string;
  message: string;
}

@Injectable()
export class CreateUserAuditLogUseCase {
  private readonly logger = new Logger(CreateUserAuditLogUseCase.name);

  constructor(
    @Inject(USER_AUDIT_LOG_REPOSITORY)
    private readonly userAuditLogRepository: UserAuditLogRepositoryInterface,
  ) {}

  async execute(
    request: CreateUserAuditLogRequest,
  ): Promise<CreateUserAuditLogResponse> {
    try {
      const exists = await this.userAuditLogRepository.exists(
        request.transactionHash,
        request.eventType,
      );

      if (exists) {
        this.logger.debug(
          `User audit log already exists for transaction ${request.transactionHash} and event ${request.eventType}`,
        );
        return {
          success: true,
          message: 'Audit log already exists',
        };
      }

      const auditLog = UserAuditLog.fromBlockchainEvent(request);
      const createdAuditLog =
        await this.userAuditLogRepository.create(auditLog);

      this.logger.log(
        `Created user audit log for ${request.eventType} - user: ${request.userAddress}, token: ${request.contractAddress}:${request.tokenId}`,
      );

      return {
        success: true,
        auditLogId: createdAuditLog.id,
        message: 'User audit log created successfully',
      };
    } catch (error) {
      this.logger.error('Failed to create user audit log', {
        error: error.message,
        request,
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
