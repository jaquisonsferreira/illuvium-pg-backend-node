import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  Matches,
  IsUUID,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';

export class BatchListingItemDto {
  @ApiProperty({
    description: 'Asset ID to create listing for',
    example: 'asset-uuid',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  assetId: string;

  @ApiProperty({
    description: 'Price in wei as string for precision',
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

export class CreateBatchListingsDto {
  @ApiProperty({
    description: 'Array of listings to create (max 100 items)',
    type: [BatchListingItemDto],
    maxItems: 100,
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one listing is required' })
  @ArrayMaxSize(100, {
    message: 'Cannot create more than 100 listings at once',
  })
  @ValidateNested({ each: true })
  @Type(() => BatchListingItemDto)
  listings: BatchListingItemDto[];

  @ApiProperty({
    description: 'Seller address for all listings',
    example: '0x1234567890123456789012345678901234567890',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  sellerAddress: string;
}
