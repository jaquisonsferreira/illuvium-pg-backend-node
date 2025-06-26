import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import {
  CreateBatchListingsUseCase,
  CancelBatchListingsUseCase,
  UpdateBatchListingsUseCase,
} from '../../application/use-cases';
import {
  CreateBatchListingsDto,
  CancelBatchListingsDto,
  UpdateBatchListingsDto,
} from '../../application/dtos';
import { BatchCreateResult } from '../../application/use-cases/create-batch-listings.use-case';
import { BatchCancelResult } from '../../application/use-cases/cancel-batch-listings.use-case';
import { BatchUpdateResult } from '../../application/use-cases/update-batch-listings.use-case';

@ApiTags('marketplace-batch')
@ApiBearerAuth()
@Controller('marketplace/batch')
export class MarketplaceBatchController {
  constructor(
    private readonly createBatchListingsUseCase: CreateBatchListingsUseCase,
    private readonly cancelBatchListingsUseCase: CancelBatchListingsUseCase,
    private readonly updateBatchListingsUseCase: UpdateBatchListingsUseCase,
  ) {}

  @Post('listings')
  @ApiOperation({
    summary: 'Create multiple sale listings in batch',
    description:
      'Create up to 100 sale listings at once. Returns detailed results with success/failure counts.',
  })
  @ApiQuery({
    name: 'sellerAddress',
    description: 'Seller wallet address',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description:
      'Batch listing creation completed (may include partial failures).',
    schema: {
      type: 'object',
      properties: {
        successCount: { type: 'number', example: 8 },
        failureCount: { type: 'number', example: 2 },
        created: {
          type: 'array',
          items: { type: 'object' },
          description: 'Successfully created listings',
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              assetId: { type: 'string' },
              error: { type: 'string' },
            },
          },
          description: 'Errors for failed listings',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or no valid listings to create.',
  })
  async createBatchListings(
    @Body() createBatchDto: CreateBatchListingsDto,
    @Query('sellerAddress') sellerAddress: string,
  ): Promise<BatchCreateResult> {
    if (!sellerAddress) {
      throw new BadRequestException(
        'sellerAddress query parameter is required',
      );
    }

    const dto = { ...createBatchDto, sellerAddress };
    return this.createBatchListingsUseCase.execute(dto);
  }

  @Delete('listings')
  @ApiOperation({
    summary: 'Cancel multiple listings in batch',
    description:
      'Cancel up to 100 active listings at once. Only the seller can cancel their listings.',
  })
  @ApiQuery({
    name: 'sellerAddress',
    description: 'Seller wallet address',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description:
      'Batch listing cancellation completed (may include partial failures).',
    schema: {
      type: 'object',
      properties: {
        successCount: { type: 'number', example: 8 },
        failureCount: { type: 'number', example: 2 },
        cancelledIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of successfully cancelled listings',
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              listingId: { type: 'string' },
              error: { type: 'string' },
            },
          },
          description: 'Errors for failed cancellations',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or no valid listings to cancel.',
  })
  async cancelBatchListings(
    @Body() cancelBatchDto: CancelBatchListingsDto,
    @Query('sellerAddress') sellerAddress: string,
  ): Promise<BatchCancelResult> {
    if (!sellerAddress) {
      throw new BadRequestException(
        'sellerAddress query parameter is required',
      );
    }

    const dto = { ...cancelBatchDto, sellerAddress };
    return this.cancelBatchListingsUseCase.execute(dto);
  }

  @Put('listings')
  @ApiOperation({
    summary: 'Update multiple listings in batch',
    description:
      'Update up to 100 active listings at once. Only the seller can update their listings.',
  })
  @ApiQuery({
    name: 'sellerAddress',
    description: 'Seller wallet address',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description:
      'Batch listing update completed (may include partial failures).',
    schema: {
      type: 'object',
      properties: {
        successCount: { type: 'number', example: 8 },
        failureCount: { type: 'number', example: 2 },
        updated: {
          type: 'array',
          items: { type: 'object' },
          description: 'Successfully updated listings',
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              listingId: { type: 'string' },
              error: { type: 'string' },
            },
          },
          description: 'Errors for failed updates',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or no valid listings to update.',
  })
  async updateBatchListings(
    @Body() updateBatchDto: UpdateBatchListingsDto,
    @Query('sellerAddress') sellerAddress: string,
  ): Promise<BatchUpdateResult> {
    if (!sellerAddress) {
      throw new BadRequestException(
        'sellerAddress query parameter is required',
      );
    }

    const dto = { ...updateBatchDto, sellerAddress };
    return this.updateBatchListingsUseCase.execute(dto);
  }
}
