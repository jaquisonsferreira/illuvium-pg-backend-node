import { Injectable, Inject, Logger } from '@nestjs/common';
import { DeveloperAuditLog } from '../../domain/entities/developer-audit-log.entity';
import { DeveloperAuditLogRepositoryInterface } from '../../domain/repositories/developer-audit-log.repository.interface';
import { DeveloperAuditEventType } from '../../domain/types/audit-event.types';
import { DEVELOPER_AUDIT_LOG_REPOSITORY } from '../../constants';

export interface CreateDeveloperAuditLogRequest {
  eventType: DeveloperAuditEventType;
  contractAddress: string;
  actorAddress: string;
  networkName: string;
  blockNumber: number;
  transactionHash: string;
  previousValue?: string;
  newValue?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CreateDeveloperAuditLogResponse {
  success: boolean;
  auditLogId?: string;
  message: string;
}

@Injectable()
export class CreateDeveloperAuditLogUseCase {
  private readonly logger = new Logger(CreateDeveloperAuditLogUseCase.name);

  constructor(
    @Inject(DEVELOPER_AUDIT_LOG_REPOSITORY)
    private readonly developerAuditLogRepository: DeveloperAuditLogRepositoryInterface,
  ) {}

  async execute(
    request: CreateDeveloperAuditLogRequest,
  ): Promise<CreateDeveloperAuditLogResponse> {
    try {
      const exists = await this.developerAuditLogRepository.exists(
        request.transactionHash,
        request.eventType,
      );

      if (exists) {
        this.logger.debug(
          `Developer audit log already exists for transaction ${request.transactionHash} and event ${request.eventType}`,
        );
        return {
          success: true,
          message: 'Audit log already exists',
        };
      }

      const auditLog = DeveloperAuditLog.fromBlockchainEvent(request);
      const createdAuditLog =
        await this.developerAuditLogRepository.create(auditLog);

      this.logger.log(
        `Created developer audit log for ${request.eventType} - contract: ${request.contractAddress}, actor: ${request.actorAddress}`,
      );

      return {
        success: true,
        auditLogId: createdAuditLog.id,
        message: 'Developer audit log created successfully',
      };
    } catch (error) {
      this.logger.error('Failed to create developer audit log', {
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
