import {
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiKeyPermission } from '../../constants';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsArray()
  @IsEnum(ApiKeyPermission, { each: true })
  permissions: ApiKeyPermission[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
