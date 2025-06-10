import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AssetMarketplace } from '../../domain/entities/asset-marketplace.entity';
import { AssetMarketplaceRepositoryInterface } from '../../domain/repositories/asset-marketplace.repository.interface';
import { BlockchainAssetRepositoryInterface } from '../../domain/repositories/blockchain-asset.repository.interface';
import {
  ASSET_MARKETPLACE_REPOSITORY,
  BLOCKCHAIN_ASSET_REPOSITORY,
} from '../../constants';

export interface CreateBidDto {
  assetId: string;
  buyerAddress: string;
  price: string;
  currencyContract?: string;
  expiresAt?: Date;
}

@Injectable()
export class CreateBidUseCase {
  constructor(
    @Inject(ASSET_MARKETPLACE_REPOSITORY)
    private readonly marketplaceRepository: AssetMarketplaceRepositoryInterface,
    @Inject(BLOCKCHAIN_ASSET_REPOSITORY)
    private readonly assetRepository: BlockchainAssetRepositoryInterface,
  ) {}

  async execute(dto: CreateBidDto): Promise<AssetMarketplace> {
    const { assetId, buyerAddress, price, currencyContract, expiresAt } = dto;

    const asset = await this.assetRepository.findById(assetId);
    if (!asset) {
      throw new BadRequestException('Asset not found');
    }

    if (asset.ownerAddress.toLowerCase() === buyerAddress.toLowerCase()) {
      throw new ForbiddenException('Cannot bid on your own asset');
    }

    if (!price || BigInt(price) <= 0n) {
      throw new BadRequestException('Bid price must be greater than zero');
    }

    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    const bestBid =
      await this.marketplaceRepository.findBestBidForAsset(assetId);
    if (bestBid && BigInt(bestBid.price) >= BigInt(price)) {
      throw new BadRequestException(
        `Bid must be higher than the current best bid of ${bestBid.price}`,
      );
    }

    const existingBids =
      await this.marketplaceRepository.findActiveBidsForAsset(assetId);
    const userExistingBid = existingBids.find(
      (bid) => bid.buyerAddress?.toLowerCase() === buyerAddress.toLowerCase(),
    );

    if (userExistingBid) {
      throw new BadRequestException(
        'You already have an active bid for this asset',
      );
    }

    const bid = new AssetMarketplace({
      assetId,
      listingType: 'BID',
      price,
      currencyContract,
      sellerAddress: asset.ownerAddress,
      buyerAddress,
      status: 'ACTIVE',
      expiresAt,
    });

    return this.marketplaceRepository.create(bid);
  }
}
