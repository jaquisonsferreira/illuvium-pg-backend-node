import { Test, TestingModule } from '@nestjs/testing';
import { CreateSaleUseCase, CreateSaleRequest } from './create-sale.use-case';
import { IDeveloperApiKeyRepository } from '../../domain/repositories/developer-api-key.repository.interface';
import { IDeveloperNftOperationRepository } from '../../domain/repositories/developer-nft-operation.repository.interface';
import {
  DEVELOPER_API_KEY_REPOSITORY,
  DEVELOPER_NFT_OPERATION_REPOSITORY,
  ApiKeyStatus,
  ApiKeyPermission,
  NftOperationType,
  NftOperationStatus,
} from '../../constants';
import { DeveloperApiKey } from '../../domain/entities/developer-api-key.entity';
import { DeveloperNftOperation } from '../../domain/entities/developer-nft-operation.entity';

describe('CreateSaleUseCase', () => {
  let useCase: CreateSaleUseCase;
  let mockApiKeyRepository: jest.Mocked<IDeveloperApiKeyRepository>;
  let mockNftOperationRepository: jest.Mocked<IDeveloperNftOperationRepository>;

  const mockApiKey = new DeveloperApiKey(
    '123e4567-e89b-12d3-a456-426614174000',
    'hashed_key',
    'Test API Key',
    [ApiKeyPermission.SALES],
    ApiKeyStatus.ACTIVE,
    'user123',
    new Date('2024-12-31'),
    new Date('2023-01-01'),
    new Date('2023-01-01'),
    null,
  );

  const mockOperation = new DeveloperNftOperation(
    '456e7890-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    NftOperationType.SALE,
    NftOperationStatus.PENDING,
    null,
    '1',
    null,
    { price: '100', currency: 'ETH' },
    null,
    null,
    null,
    new Date('2023-01-01'),
    new Date('2023-01-01'),
  );

  beforeEach(async () => {
    const mockApiKeyRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockNftOperationRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByApiKeyId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateSaleUseCase,
        {
          provide: DEVELOPER_API_KEY_REPOSITORY,
          useValue: mockApiKeyRepo,
        },
        {
          provide: DEVELOPER_NFT_OPERATION_REPOSITORY,
          useValue: mockNftOperationRepo,
        },
      ],
    }).compile();

    useCase = module.get<CreateSaleUseCase>(CreateSaleUseCase);
    mockApiKeyRepository = module.get(DEVELOPER_API_KEY_REPOSITORY);
    mockNftOperationRepository = module.get(DEVELOPER_NFT_OPERATION_REPOSITORY);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should create sale operation successfully', async () => {
    const request: CreateSaleRequest = {
      apiKeyId: '123e4567-e89b-12d3-a456-426614174000',
      contractAddress: '0x123...abc',
      tokenId: '1',
      fromAddress: '0x456...def',
      price: 100,
      currency: 'ETH',
    };

    mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
    mockNftOperationRepository.create.mockResolvedValue(mockOperation);

    const result = await useCase.execute(request);

    expect(result).toBe(mockOperation);
    expect(mockApiKeyRepository.findById).toHaveBeenCalledWith(request.apiKeyId);
    expect(mockNftOperationRepository.create).toHaveBeenCalledWith({
      apiKeyId: request.apiKeyId,
      operationType: NftOperationType.SALE,
      toAddress: null,
      tokenId: request.tokenId,
      amount: null,
      metadata: { 
        contractAddress: request.contractAddress,
        fromAddress: request.fromAddress,
        price: request.price, 
        currency: request.currency 
      },
    });
  });

  it('should create sale operation with zero price', async () => {
    const request: CreateSaleRequest = {
      apiKeyId: '123e4567-e89b-12d3-a456-426614174000',
      contractAddress: '0x123...abc',
      tokenId: '1',
      fromAddress: '0x456...def',
      price: 0,
      currency: 'ETH',
    };

    mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
    mockNftOperationRepository.create.mockResolvedValue(mockOperation);

    const result = await useCase.execute(request);

    expect(result).toBe(mockOperation);
    expect(mockNftOperationRepository.create).toHaveBeenCalledWith({
      apiKeyId: request.apiKeyId,
      operationType: NftOperationType.SALE,
      toAddress: null,
      tokenId: request.tokenId,
      amount: null,
      metadata: { 
        contractAddress: request.contractAddress,
        fromAddress: request.fromAddress,
        price: request.price, 
        currency: request.currency 
      },
    });
  });

  it('should throw error when API key not found', async () => {
    const request: CreateSaleRequest = {
      apiKeyId: 'non-existent',
      contractAddress: '0x123...abc',
      tokenId: '1',
      fromAddress: '0x456...def',
      price: 100,
      currency: 'ETH',
    };

    mockApiKeyRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(request)).rejects.toThrow('API Key not found');
    expect(mockNftOperationRepository.create).not.toHaveBeenCalled();
  });

  it('should handle repository errors', async () => {
    const request: CreateSaleRequest = {
      apiKeyId: '123e4567-e89b-12d3-a456-426614174000',
      contractAddress: '0x123...abc',
      tokenId: '1',
      fromAddress: '0x456...def',
      price: 100,
      currency: 'ETH',
    };

    mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
    mockNftOperationRepository.create.mockRejectedValue(new Error('Database error'));

    await expect(useCase.execute(request)).rejects.toThrow('Database error');
  });
});
