import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreateBatchListingsUseCase } from '../create-batch-listings.use-case';
import { AssetMarketplaceRepositoryInterface } from '../../../domain/repositories/asset-marketplace.repository.interface';
import { BlockchainAssetRepositoryInterface } from '../../../domain/repositories/blockchain-asset.repository.interface';
import {
  ASSET_MARKETPLACE_REPOSITORY,
  BLOCKCHAIN_ASSET_REPOSITORY,
} from '../../../constants';
import { BlockchainAsset } from '../../../domain/entities/blockchain-asset.entity';
import { AssetMarketplace } from '../../../domain/entities/asset-marketplace.entity';

describe('CreateBatchListingsUseCase', () => {
  let useCase: CreateBatchListingsUseCase;
  let marketplaceRepository: jest.Mocked<AssetMarketplaceRepositoryInterface>;
  let assetRepository: jest.Mocked<BlockchainAssetRepositoryInterface>;

  const mockAsset = new BlockchainAsset({
    id: 'asset-1',
    contractId: 'contract-1',
    ownerAddress: '0x1234567890123456789012345678901234567890',
    balance: '1',
    lastUpdatedBlock: '12345',
  });

  beforeEach(async () => {
    const mockMarketplaceRepository = {
      findActiveSalesForAsset: jest.fn(),
      createMany: jest.fn(),
    };

    const mockAssetRepository = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateBatchListingsUseCase,
        {
          provide: ASSET_MARKETPLACE_REPOSITORY,
          useValue: mockMarketplaceRepository,
        },
        {
          provide: BLOCKCHAIN_ASSET_REPOSITORY,
          useValue: mockAssetRepository,
        },
      ],
    }).compile();

    useCase = module.get<CreateBatchListingsUseCase>(
      CreateBatchListingsUseCase,
    );
    marketplaceRepository = module.get(ASSET_MARKETPLACE_REPOSITORY);
    assetRepository = module.get(BLOCKCHAIN_ASSET_REPOSITORY);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should create batch listings successfully', async () => {
    const dto = {
      listings: [
        {
          assetId: 'asset-1',
          price: '1000000000000000000',
        },
      ],
      sellerAddress: '0x1234567890123456789012345678901234567890',
    };

    const mockListing = new AssetMarketplace({
      assetId: 'asset-1',
      listingType: 'SALE',
      price: '1000000000000000000',
      sellerAddress: '0x1234567890123456789012345678901234567890',
    });

    assetRepository.findById.mockResolvedValue(mockAsset);
    marketplaceRepository.findActiveSalesForAsset.mockResolvedValue([]);
    marketplaceRepository.createMany.mockResolvedValue([mockListing]);

    const result = await useCase.execute(dto);

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(0);
    expect(result.created).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('should throw error for duplicate asset IDs', async () => {
    const dto = {
      listings: [
        {
          assetId: 'asset-1',
          price: '1000000000000000000',
        },
        {
          assetId: 'asset-1',
          price: '2000000000000000000',
        },
      ],
      sellerAddress: '0x1234567890123456789012345678901234567890',
    };

    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
  });

  it('should handle partial failures', async () => {
    const dto = {
      listings: [
        {
          assetId: 'asset-1',
          price: '1000000000000000000',
        },
        {
          assetId: 'asset-2',
          price: '2000000000000000000',
        },
      ],
      sellerAddress: '0x1234567890123456789012345678901234567890',
    };

    const mockListing = new AssetMarketplace({
      assetId: 'asset-1',
      listingType: 'SALE',
      price: '1000000000000000000',
      sellerAddress: '0x1234567890123456789012345678901234567890',
    });

    assetRepository.findById.mockImplementation((id) => {
      if (id === 'asset-1') return Promise.resolve(mockAsset);
      return Promise.resolve(null);
    });
    marketplaceRepository.findActiveSalesForAsset.mockResolvedValue([]);
    marketplaceRepository.createMany.mockResolvedValue([mockListing]);

    const result = await useCase.execute(dto);

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.created).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe('Asset not found');
  });
});
