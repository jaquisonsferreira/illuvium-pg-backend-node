import { Test, TestingModule } from '@nestjs/testing';
import { TransferNftUseCase } from './transfer-nft.use-case';
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

describe('TransferNftUseCase', () => {
  let useCase: TransferNftUseCase;
  let mockApiKeyRepository: jest.Mocked<IDeveloperApiKeyRepository>;
  let mockNftOperationRepository: jest.Mocked<IDeveloperNftOperationRepository>;

  const mockApiKey = new DeveloperApiKey(
    '123e4567-e89b-12d3-a456-426614174000',
    'hashed_key',
    'Test API Key',
    [ApiKeyPermission.TRANSFER],
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
    NftOperationType.TRANSFER,
    NftOperationStatus.PENDING,
    '0x1234567890123456789012345678901234567890',
    '1',
    1,
    null,
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
        TransferNftUseCase,
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

    useCase = module.get<TransferNftUseCase>(TransferNftUseCase);
    mockApiKeyRepository = module.get(DEVELOPER_API_KEY_REPOSITORY);
    mockNftOperationRepository = module.get(DEVELOPER_NFT_OPERATION_REPOSITORY);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should create transfer operation successfully', async () => {
    const request = {
      apiKeyId: '123e4567-e89b-12d3-a456-426614174000',
      toAddress: '0x1234567890123456789012345678901234567890',
      tokenId: '1',
      amount: 1,
    };

    mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
    mockNftOperationRepository.create.mockResolvedValue(mockOperation);

    const result = await useCase.execute(request);

    expect(result).toBe(mockOperation);
    expect(mockApiKeyRepository.findById).toHaveBeenCalledWith(request.apiKeyId);
    expect(mockNftOperationRepository.create).toHaveBeenCalledWith({
      apiKeyId: request.apiKeyId,
      operationType: NftOperationType.TRANSFER,
      toAddress: request.toAddress,
      tokenId: request.tokenId,
      amount: request.amount,
      metadata: null,
    });
  });

  it('should create transfer operation with optional amount as null', async () => {
    const request = {
      apiKeyId: '123e4567-e89b-12d3-a456-426614174000',
      toAddress: '0x1234567890123456789012345678901234567890',
      tokenId: '1',
    };

    mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
    mockNftOperationRepository.create.mockResolvedValue(mockOperation);

    const result = await useCase.execute(request);

    expect(result).toBe(mockOperation);
    expect(mockNftOperationRepository.create).toHaveBeenCalledWith({
      apiKeyId: request.apiKeyId,
      operationType: NftOperationType.TRANSFER,
      toAddress: request.toAddress,
      tokenId: request.tokenId,
      amount: null,
      metadata: null,
    });
  });

  it('should throw error when API key not found', async () => {
    const request = {
      apiKeyId: 'non-existent',
      toAddress: '0x1234567890123456789012345678901234567890',
      tokenId: '1',
    };

    mockApiKeyRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(request)).rejects.toThrow('API Key not found');
    expect(mockNftOperationRepository.create).not.toHaveBeenCalled();
  });

  it('should handle repository errors', async () => {
    const request = {
      apiKeyId: '123e4567-e89b-12d3-a456-426614174000',
      toAddress: '0x1234567890123456789012345678901234567890',
      tokenId: '1',
    };

    mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
    mockNftOperationRepository.create.mockRejectedValue(new Error('Database error'));

    await expect(useCase.execute(request)).rejects.toThrow('Database error');
  });
});
