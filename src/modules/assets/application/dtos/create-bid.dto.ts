import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  Matches,
  IsUUID,
} from 'class-validator';

export class CreateBidDto {
  @ApiProperty({
    description: 'Bid price in wei as string for precision',
    example: '1000000000000000000',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'Price must be a valid number string' })
  price: string;

  @ApiPropertyOptional({
    description:
      'Currency contract ID (UUID). If not provided, uses native token (ETH)',
    example: 'currency-contract-uuid',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  currencyContract?: string;

  @ApiPropertyOptional({
    description: 'Expiration date in ISO string format',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  expiresAt?: Date;
}
