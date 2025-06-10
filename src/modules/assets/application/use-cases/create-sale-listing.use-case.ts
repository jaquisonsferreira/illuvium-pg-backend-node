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

export interface CreateSaleListingDto {
  assetId: string;
  sellerAddress: string;
  price: string;
  currencyContract?: string;
  expiresAt?: Date;
}

@Injectable()
export class CreateSaleListingUseCase {
  constructor(
    @Inject(ASSET_MARKETPLACE_REPOSITORY)
    private readonly marketplaceRepository: AssetMarketplaceRepositoryInterface,
    @Inject(BLOCKCHAIN_ASSET_REPOSITORY)
    private readonly assetRepository: BlockchainAssetRepositoryInterface,
  ) {}

  async execute(dto: CreateSaleListingDto): Promise<AssetMarketplace> {
    const { assetId, sellerAddress, price, currencyContract, expiresAt } = dto;

    const asset = await this.assetRepository.findById(assetId);
    if (!asset) {
      throw new BadRequestException('Asset not found');
    }

    if (asset.ownerAddress.toLowerCase() !== sellerAddress.toLowerCase()) {
      throw new ForbiddenException(
        'Only the asset owner can create a sale listing',
      );
    }

    if (!asset.hasBalance()) {
      throw new BadRequestException('Cannot sell asset with zero balance');
    }

    if (!price || BigInt(price) <= 0n) {
      throw new BadRequestException('Price must be greater than zero');
    }

    const existingActiveSales =
      await this.marketplaceRepository.findActiveSalesForAsset(assetId);
    if (existingActiveSales.length > 0) {
      throw new BadRequestException('Asset already has an active sale listing');
    }

    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    const saleListing = new AssetMarketplace({
      assetId,
      listingType: 'SALE',
      price,
      currencyContract,
      sellerAddress,
      status: 'ACTIVE',
      expiresAt,
    });

    return this.marketplaceRepository.create(saleListing);
  }
}
