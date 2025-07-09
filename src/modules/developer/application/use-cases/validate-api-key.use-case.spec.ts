import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ValidateApiKeyUseCase } from './validate-api-key.use-case';
import { IDeveloperApiKeyRepository } from '../../domain/repositories/developer-api-key.repository.interface';
import {
  DEVELOPER_API_KEY_REPOSITORY,
  ApiKeyStatus,
  ApiKeyPermission,
} from '../../constants';
import { DeveloperApiKey } from '../../domain/entities/developer-api-key.entity';

describe('ValidateApiKeyUseCase', () => {
  let useCase: ValidateApiKeyUseCase;
  let mockRepository: jest.Mocked<IDeveloperApiKeyRepository>;

  const mockApiKey = new DeveloperApiKey(
    '123e4567-e89b-12d3-a456-426614174000',
    'test_api_key_123',
    'Test API Key',
    [ApiKeyPermission.MINTING, ApiKeyPermission.BURNING],
    ApiKeyStatus.ACTIVE,
    'user123',
    new Date('2025-12-31'),
    new Date('2023-01-01'),
    new Date('2023-01-01'),
    null,
  );

  beforeEach(async () => {
    const mockApiKeyRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByKey: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateLastUsed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidateApiKeyUseCase,
        {
          provide: DEVELOPER_API_KEY_REPOSITORY,
          useValue: mockApiKeyRepository,
        },
      ],
    }).compile();

    useCase = module.get<ValidateApiKeyUseCase>(ValidateApiKeyUseCase);
    mockRepository = module.get<jest.Mocked<IDeveloperApiKeyRepository>>(
      DEVELOPER_API_KEY_REPOSITORY,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should validate API key successfully', async () => {
    const request = {
      apiKey: 'test_api_key_123',
      requiredPermission: ApiKeyPermission.MINTING,
    };

    mockRepository.findByKey.mockResolvedValue(mockApiKey);
    mockRepository.updateLastUsed.mockResolvedValue();

    const result = await useCase.execute(request);

    expect(result).toBe(mockApiKey);
    expect(mockRepository.findByKey).toHaveBeenCalledWith(request.apiKey);
    expect(mockRepository.updateLastUsed).toHaveBeenCalledWith(mockApiKey.id);
  });

  it('should throw UnauthorizedException when API key is not found', async () => {
    const request = { apiKey: 'invalid_key' };

    mockRepository.findByKey.mockResolvedValue(null);

    await expect(useCase.execute(request)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(useCase.execute(request)).rejects.toThrow('Invalid API key');
    expect(mockRepository.findByKey).toHaveBeenCalledWith(request.apiKey);
  });

  it('should throw UnauthorizedException when API key is inactive', async () => {
    const inactiveApiKey = new DeveloperApiKey(
      '123e4567-e89b-12d3-a456-426614174000',
      'test_api_key_123',
      'Test API Key',
      [ApiKeyPermission.MINTING, ApiKeyPermission.BURNING],
      ApiKeyStatus.INACTIVE,
      'user123',
      new Date('2025-12-31'),
      new Date('2023-01-01'),
      new Date('2023-01-01'),
      null,
    );

    const request = { apiKey: 'test_api_key_123' };
    mockRepository.findByKey.mockResolvedValue(inactiveApiKey);

    await expect(useCase.execute(request)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(useCase.execute(request)).rejects.toThrow(
      'API key is not active',
    );
  });

  it('should throw UnauthorizedException when API key is expired', async () => {
    const expiredApiKey = new DeveloperApiKey(
      '123e4567-e89b-12d3-a456-426614174000',
      'test_api_key_123',
      'Test API Key',
      [ApiKeyPermission.MINTING, ApiKeyPermission.BURNING],
      ApiKeyStatus.ACTIVE,
      'user123',
      new Date('2022-01-01'), // Expired
      new Date('2023-01-01'),
      new Date('2023-01-01'),
      null,
    );

    const request = { apiKey: 'test_api_key_123' };
    mockRepository.findByKey.mockResolvedValue(expiredApiKey);

    await expect(useCase.execute(request)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(useCase.execute(request)).rejects.toThrow(
      'API key has expired',
    );
  });

  it('should throw UnauthorizedException when API key lacks required permission', async () => {
    const request = {
      apiKey: 'test_api_key_123',
      requiredPermission: ApiKeyPermission.SALES,
    };

    mockRepository.findByKey.mockResolvedValue(mockApiKey);

    await expect(useCase.execute(request)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(useCase.execute(request)).rejects.toThrow(
      'API key does not have required permission: sales',
    );
  });

  it('should validate API key without required permission check', async () => {
    const request = { apiKey: 'test_api_key_123' };

    mockRepository.findByKey.mockResolvedValue(mockApiKey);
    mockRepository.updateLastUsed.mockResolvedValue();

    const result = await useCase.execute(request);

    expect(result).toBe(mockApiKey);
    expect(mockRepository.findByKey).toHaveBeenCalledWith(request.apiKey);
    expect(mockRepository.updateLastUsed).toHaveBeenCalledWith(mockApiKey.id);
  });
});
