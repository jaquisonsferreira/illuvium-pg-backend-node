import { Module } from '@nestjs/common';
import { AuditController } from './interface/controllers/audit.controller';
import { CreateUserAuditLogUseCase } from './application/use-cases/create-user-audit-log.use-case';
import { CreateDeveloperAuditLogUseCase } from './application/use-cases/create-developer-audit-log.use-case';
import { ProcessBlockchainEventForAuditUseCase } from './application/use-cases/process-blockchain-event-for-audit.use-case';
import { UserAuditLogRepository } from './infrastructure/repositories/user-audit-log.repository';
import { DeveloperAuditLogRepository } from './infrastructure/repositories/developer-audit-log.repository';
import {
  USER_AUDIT_LOG_REPOSITORY,
  DEVELOPER_AUDIT_LOG_REPOSITORY,
} from './constants';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
  providers: [
    {
      provide: USER_AUDIT_LOG_REPOSITORY,
      useClass: UserAuditLogRepository,
    },
    {
      provide: DEVELOPER_AUDIT_LOG_REPOSITORY,
      useClass: DeveloperAuditLogRepository,
    },
    CreateUserAuditLogUseCase,
    CreateDeveloperAuditLogUseCase,
    ProcessBlockchainEventForAuditUseCase,
  ],
  exports: [
    CreateUserAuditLogUseCase,
    CreateDeveloperAuditLogUseCase,
    ProcessBlockchainEventForAuditUseCase,
    USER_AUDIT_LOG_REPOSITORY,
    DEVELOPER_AUDIT_LOG_REPOSITORY,
  ],
})
export class AuditModule {}
