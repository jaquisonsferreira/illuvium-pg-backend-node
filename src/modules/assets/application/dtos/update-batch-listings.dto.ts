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

export class BatchListingUpdateDto {
  @ApiProperty({
    description: 'Listing ID to update',
    example: 'listing-uuid',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  listingId: string;

  @ApiPropertyOptional({
    description: 'New price in wei as string for precision',
    example: '2000000000000000000',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'Price must be a valid number string' })
  price?: string;

  @ApiPropertyOptional({
    description: 'New expiration date in ISO string format',
    example: '2025-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  expiresAt?: Date;
}

export class UpdateBatchListingsDto {
  @ApiProperty({
    description: 'Array of listing updates (max 100 items)',
    type: [BatchListingUpdateDto],
    maxItems: 100,
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one listing update is required' })
  @ArrayMaxSize(100, {
    message: 'Cannot update more than 100 listings at once',
  })
  @ValidateNested({ each: true })
  @Type(() => BatchListingUpdateDto)
  updates: BatchListingUpdateDto[];

  @ApiProperty({
    description: 'Seller address requesting the updates',
    example: '0x1234567890123456789012345678901234567890',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  sellerAddress: string;
}
