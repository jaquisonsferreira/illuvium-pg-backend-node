import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  Matches,
} from 'class-validator';

export class CancelBatchListingsDto {
  @ApiProperty({
    description: 'Array of listing IDs to cancel (max 100 items)',
    type: [String],
    maxItems: 100,
    minItems: 1,
    example: ['listing-uuid-1', 'listing-uuid-2'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one listing ID is required' })
  @ArrayMaxSize(100, {
    message: 'Cannot cancel more than 100 listings at once',
  })
  @IsUUID('4', { each: true, message: 'Each listing ID must be a valid UUID' })
  listingIds: string[];

  @ApiProperty({
    description: 'Seller address requesting the cancellation',
    example: '0x1234567890123456789012345678901234567890',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  sellerAddress: string;
}
