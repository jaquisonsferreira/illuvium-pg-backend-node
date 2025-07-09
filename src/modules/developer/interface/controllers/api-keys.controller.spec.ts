import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysController } from './api-keys.controller';
import { CreateApiKeyUseCase } from '../../application/use-cases/create-api-key.use-case';
import { CreateApiKeyDto } from '../dtos/create-api-key.dto';
import { DeveloperApiKey } from '../../domain/entities/developer-api-key.entity';
import { ApiKeyStatus, ApiKeyPermission } from '../../constants';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  let mockCreateApiKeyUseCase: jest.Mocked<CreateApiKeyUseCase>;

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
    const mockCreateUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [
        {
          provide: CreateApiKeyUseCase,
          useValue: mockCreateUseCase,
        },
      ],
    }).compile();

    controller = module.get<ApiKeysController>(ApiKeysController);
    mockCreateApiKeyUseCase = module.get(CreateApiKeyUseCase);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create an API key successfully', async () => {
    const createDto: CreateApiKeyDto = {
      name: 'Test API Key',
      permissions: [ApiKeyPermission.MINTING, ApiKeyPermission.BURNING],
      expiresAt: '2024-12-31T00:00:00Z',
    };

    const mockRequest = {
      user: { id: 'user123' },
    };

    mockCreateApiKeyUseCase.execute.mockResolvedValue(mockApiKey);

    const result = await controller.createApiKey(createDto, mockRequest);

    expect(result).toEqual({
      id: mockApiKey.id,
      key: mockApiKey.key,
      name: mockApiKey.name,
      permissions: mockApiKey.permissions,
      status: mockApiKey.status,
      expiresAt: mockApiKey.expiresAt,
      createdAt: mockApiKey.createdAt,
    });
    expect(mockCreateApiKeyUseCase.execute).toHaveBeenCalledWith({
      name: createDto.name,
      permissions: createDto.permissions,
      userId: mockRequest.user.id,
      expiresAt: createDto.expiresAt
        ? new Date(createDto.expiresAt)
        : undefined,
    });
  });

  it('should create an API key without expiration date', async () => {
    const createDto: CreateApiKeyDto = {
      name: 'Test API Key',
      permissions: [ApiKeyPermission.MINTING, ApiKeyPermission.BURNING],
    };

    const mockRequest = {
      user: { id: 'user123' },
    };

    mockCreateApiKeyUseCase.execute.mockResolvedValue(mockApiKey);

    const result = await controller.createApiKey(createDto, mockRequest);

    expect(result).toEqual({
      id: mockApiKey.id,
      key: mockApiKey.key,
      name: mockApiKey.name,
      permissions: mockApiKey.permissions,
      status: mockApiKey.status,
      expiresAt: mockApiKey.expiresAt,
      createdAt: mockApiKey.createdAt,
    });
    expect(mockCreateApiKeyUseCase.execute).toHaveBeenCalledWith({
      name: createDto.name,
      permissions: createDto.permissions,
      userId: mockRequest.user.id,
      expiresAt: createDto.expiresAt
        ? new Date(createDto.expiresAt)
        : undefined,
    });
  });

  it('should handle errors when creating API key fails', async () => {
    const createDto: CreateApiKeyDto = {
      name: 'Test API Key',
      permissions: [ApiKeyPermission.MINTING, ApiKeyPermission.BURNING],
    };

    const mockRequest = {
      user: { id: 'user123' },
    };

    mockCreateApiKeyUseCase.execute.mockRejectedValue(
      new Error('Database error'),
    );

    await expect(
      controller.createApiKey(createDto, mockRequest),
    ).rejects.toThrow('Database error');
  });
});
