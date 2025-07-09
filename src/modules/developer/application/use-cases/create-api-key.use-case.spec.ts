import { Test, TestingModule } from '@nestjs/testing';
import { CreateApiKeyUseCase } from './create-api-key.use-case';
import { IDeveloperApiKeyRepository } from '../../domain/repositories/developer-api-key.repository.interface';
import {
  DEVELOPER_API_KEY_REPOSITORY,
  ApiKeyStatus,
  ApiKeyPermission,
} from '../../constants';
import { DeveloperApiKey } from '../../domain/entities/developer-api-key.entity';

describe('CreateApiKeyUseCase', () => {
  let useCase: CreateApiKeyUseCase;
  let mockRepository: jest.Mocked<IDeveloperApiKeyRepository>;

  const mockApiKey = new DeveloperApiKey(
    '123e4567-e89b-12d3-a456-426614174000',
    'hashed_key',
    'Test API Key',
    [ApiKeyPermission.MINTING, ApiKeyPermission.BURNING],
    ApiKeyStatus.ACTIVE,
    'user123',
    new Date('2024-12-31'),
    new Date('2023-01-01'),
    new Date('2023-01-01'),
    null,
  );

  beforeEach(async () => {
    const mockApiKeyRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateApiKeyUseCase,
        {
          provide: DEVELOPER_API_KEY_REPOSITORY,
          useValue: mockApiKeyRepository,
        },
      ],
    }).compile();

    useCase = module.get<CreateApiKeyUseCase>(CreateApiKeyUseCase);
    mockRepository = module.get(DEVELOPER_API_KEY_REPOSITORY);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should create a new API key successfully', async () => {
    const request = {
      userId: 'user123',
      name: 'Test API Key',
      permissions: [ApiKeyPermission.MINTING, ApiKeyPermission.BURNING],
      expiresAt: new Date('2024-12-31'),
    };

    mockRepository.create.mockResolvedValue(mockApiKey);

    const result = await useCase.execute(request);

    expect(result).toBe(mockApiKey);
    expect(mockRepository.create).toHaveBeenCalledWith({
      userId: request.userId,
      name: request.name,
      permissions: request.permissions,
      expiresAt: request.expiresAt,
    });
  });

  it('should create API key with no expiration date', async () => {
    const request = {
      userId: 'user123',
      name: 'Test API Key',
      permissions: [ApiKeyPermission.MINTING],
    };

    mockRepository.create.mockResolvedValue(mockApiKey);

    const result = await useCase.execute(request);

    expect(result).toBe(mockApiKey);
    expect(mockRepository.create).toHaveBeenCalledWith({
      userId: request.userId,
      name: request.name,
      permissions: request.permissions,
      expiresAt: undefined,
    });
  });

  it('should handle repository errors', async () => {
    const request = {
      userId: 'user123',
      name: 'Test API Key',
      permissions: [ApiKeyPermission.MINTING],
    };

    mockRepository.create.mockRejectedValue(new Error('Database error'));

    await expect(useCase.execute(request)).rejects.toThrow('Database error');
  });
});
