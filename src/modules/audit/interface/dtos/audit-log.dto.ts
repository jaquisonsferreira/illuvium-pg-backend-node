import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  UserAuditEventType,
  DeveloperAuditEventType,
} from '../../domain/types/audit-event.types';

export class GetUserAuditLogsDto {
  @IsOptional()
  @IsString()
  userAddress?: string;

  @IsOptional()
  @IsString()
  contractAddress?: string;

  @IsOptional()
  @IsEnum(UserAuditEventType)
  eventType?: UserAuditEventType;

  @IsOptional()
  @IsString()
  networkName?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class GetDeveloperAuditLogsDto {
  @IsOptional()
  @IsString()
  contractAddress?: string;

  @IsOptional()
  @IsString()
  actorAddress?: string;

  @IsOptional()
  @IsEnum(DeveloperAuditEventType)
  eventType?: DeveloperAuditEventType;

  @IsOptional()
  @IsString()
  networkName?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}
