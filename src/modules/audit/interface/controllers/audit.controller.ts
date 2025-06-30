import {
  Controller,
  Get,
  Query,
  Param,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { UserAuditLogRepositoryInterface } from '../../domain/repositories/user-audit-log.repository.interface';
import { DeveloperAuditLogRepositoryInterface } from '../../domain/repositories/developer-audit-log.repository.interface';
import {
  USER_AUDIT_LOG_REPOSITORY,
  DEVELOPER_AUDIT_LOG_REPOSITORY,
} from '../../constants';
import { Inject } from '@nestjs/common';
import {
  GetUserAuditLogsDto,
  GetDeveloperAuditLogsDto,
} from '../dtos/audit-log.dto';

@Controller('audit')
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(
    @Inject(USER_AUDIT_LOG_REPOSITORY)
    private readonly userAuditLogRepository: UserAuditLogRepositoryInterface,
    @Inject(DEVELOPER_AUDIT_LOG_REPOSITORY)
    private readonly developerAuditLogRepository: DeveloperAuditLogRepositoryInterface,
  ) {}

  @Get('users/:userAddress')
  async getUserAuditLogs(
    @Param('userAddress') userAddress: string,
    @Query(ValidationPipe) query: GetUserAuditLogsDto,
  ) {
    try {
      this.logger.log(`Getting audit logs for user: ${userAddress}`);

      const filters = {
        contractAddress: query.contractAddress,
        eventType: query.eventType,
        networkName: query.networkName,
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
        limit: query.limit || 50,
        offset: query.offset || 0,
      };

      const [logs, total] = await Promise.all([
        this.userAuditLogRepository.findByUserAddress(userAddress, filters),
        this.userAuditLogRepository.countByFilters({
          userAddress,
          contractAddress: filters.contractAddress,
          eventType: filters.eventType,
          networkName: filters.networkName,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
        }),
      ]);

      return {
        success: true,
        data: {
          logs: logs.map((log) => log.toAuditEvent()),
          pagination: {
            total,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: filters.offset + logs.length < total,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user audit logs for ${userAddress}:`,
        error,
      );

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('users')
  async getAllUserAuditLogs(@Query(ValidationPipe) query: GetUserAuditLogsDto) {
    try {
      this.logger.log('Getting all user audit logs');

      const filters = {
        userAddress: query.userAddress,
        contractAddress: query.contractAddress,
        eventType: query.eventType,
        networkName: query.networkName,
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
        limit: query.limit || 50,
        offset: query.offset || 0,
      };

      const [logs, total] = await Promise.all([
        this.userAuditLogRepository.findByFilters(filters),
        this.userAuditLogRepository.countByFilters({
          userAddress: filters.userAddress,
          contractAddress: filters.contractAddress,
          eventType: filters.eventType,
          networkName: filters.networkName,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
        }),
      ]);

      return {
        success: true,
        data: {
          logs: logs.map((log) => log.toAuditEvent()),
          pagination: {
            total,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: filters.offset + logs.length < total,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get all user audit logs:', error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('developers/contracts/:contractAddress')
  async getDeveloperAuditLogsByContract(
    @Param('contractAddress') contractAddress: string,
    @Query(ValidationPipe) query: GetDeveloperAuditLogsDto,
  ) {
    try {
      this.logger.log(
        `Getting developer audit logs for contract: ${contractAddress}`,
      );

      const filters = {
        actorAddress: query.actorAddress,
        eventType: query.eventType,
        networkName: query.networkName,
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
        limit: query.limit || 50,
        offset: query.offset || 0,
      };

      const [logs, total] = await Promise.all([
        this.developerAuditLogRepository.findByContractAddress(
          contractAddress,
          filters,
        ),
        this.developerAuditLogRepository.countByFilters({
          contractAddress,
          actorAddress: filters.actorAddress,
          eventType: filters.eventType,
          networkName: filters.networkName,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
        }),
      ]);

      return {
        success: true,
        data: {
          logs: logs.map((log) => log.toAuditEvent()),
          pagination: {
            total,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: filters.offset + logs.length < total,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get developer audit logs for contract ${contractAddress}:`,
        error,
      );

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('developers')
  async getAllDeveloperAuditLogs(
    @Query(ValidationPipe) query: GetDeveloperAuditLogsDto,
  ) {
    try {
      this.logger.log('Getting all developer audit logs');

      const filters = {
        contractAddress: query.contractAddress,
        actorAddress: query.actorAddress,
        eventType: query.eventType,
        networkName: query.networkName,
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
        limit: query.limit || 50,
        offset: query.offset || 0,
      };

      const [logs, total] = await Promise.all([
        this.developerAuditLogRepository.findByFilters(filters),
        this.developerAuditLogRepository.countByFilters({
          contractAddress: filters.contractAddress,
          actorAddress: filters.actorAddress,
          eventType: filters.eventType,
          networkName: filters.networkName,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
        }),
      ]);

      return {
        success: true,
        data: {
          logs: logs.map((log) => log.toAuditEvent()),
          pagination: {
            total,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: filters.offset + logs.length < total,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get all developer audit logs:', error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('transaction/:transactionHash')
  async getAuditLogsByTransaction(
    @Param('transactionHash') transactionHash: string,
  ) {
    try {
      this.logger.log(`Getting audit logs for transaction: ${transactionHash}`);

      const [userLogs, developerLogs] = await Promise.all([
        this.userAuditLogRepository.findByTransactionHash(transactionHash),
        this.developerAuditLogRepository.findByTransactionHash(transactionHash),
      ]);

      return {
        success: true,
        data: {
          transactionHash,
          userLogs: userLogs.map((log) => log.toAuditEvent()),
          developerLogs: developerLogs.map((log) => log.toAuditEvent()),
          totalLogs: userLogs.length + developerLogs.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get audit logs for transaction ${transactionHash}:`,
        error,
      );

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
