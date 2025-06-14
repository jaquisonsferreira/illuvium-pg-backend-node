import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ASSET_MARKETPLACE_REPOSITORY } from '../../constants';
import { AssetMarketplaceRepositoryInterface } from '../../domain/repositories';
import { CancelBatchListingsDto } from '../dtos/cancel-batch-listings.dto';

export interface BatchCancelResult {
  successCount: number;
  failureCount: number;
  cancelledIds: string[];
  errors: Array<{
    listingId: string;
    error: string;
  }>;
}

@Injectable()
export class CancelBatchListingsUseCase {
  constructor(
    @Inject(ASSET_MARKETPLACE_REPOSITORY)
    private readonly marketplaceRepository: AssetMarketplaceRepositoryInterface,
  ) {}

  async execute(dto: CancelBatchListingsDto): Promise<BatchCancelResult> {
    const { listingIds, sellerAddress } = dto;

    const result: BatchCancelResult = {
      successCount: 0,
      failureCount: 0,
      cancelledIds: [],
      errors: [],
    };

    const uniqueListingIds = [...new Set(listingIds)];
    if (uniqueListingIds.length !== listingIds.length) {
      throw new BadRequestException('Duplicate listing IDs found in batch');
    }

    const validListingIds: string[] = [];

    for (const listingId of listingIds) {
      try {
        const listing = await this.marketplaceRepository.findById(listingId);

        if (!listing) {
          result.errors.push({
            listingId,
            error: 'Listing not found',
          });
          result.failureCount++;
          continue;
        }

        if (
          listing.sellerAddress.toLowerCase() !== sellerAddress.toLowerCase()
        ) {
          result.errors.push({
            listingId,
            error: 'Only the seller can cancel this listing',
          });
          result.failureCount++;
          continue;
        }

        if (!listing.isActive()) {
          result.errors.push({
            listingId,
            error: 'Listing cannot be cancelled (not active)',
          });
          result.failureCount++;
          continue;
        }

        validListingIds.push(listingId);
      } catch (error) {
        result.errors.push({
          listingId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.failureCount++;
      }
    }

    if (validListingIds.length === 0) {
      throw new BadRequestException('No valid listings to cancel');
    }

    try {
      const cancelled =
        await this.marketplaceRepository.cancelListings(validListingIds);
      if (cancelled) {
        result.cancelledIds = validListingIds;
        result.successCount = validListingIds.length;
      } else {
        throw new Error('Failed to cancel listings');
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to cancel batch listings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return result;
  }
}
