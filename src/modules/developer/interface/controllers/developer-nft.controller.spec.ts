import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { DeveloperNftController } from './developer-nft.controller';
import { MintNftUseCase } from '../../application/use-cases/mint-nft.use-case';
import { BurnNftUseCase } from '../../application/use-cases/burn-nft.use-case';
import { TransferNftUseCase } from '../../application/use-cases/transfer-nft.use-case';
import { UpdateNftMetadataUseCase } from '../../application/use-cases/update-nft-metadata.use-case';
import { CreateSaleUseCase } from '../../application/use-cases/create-sale.use-case';
import { ValidateApiKeyUseCase } from '../../application/use-cases/validate-api-key.use-case';
import { DeveloperNftOperation } from '../../domain/entities/developer-nft-operation.entity';
import { NftOperationType, NftOperationStatus } from '../../constants';
import { MintNftDto } from '../dtos/mint-nft.dto';
import { BurnNftDto } from '../dtos/burn-nft.dto';
import { TransferNftDto } from '../dtos/transfer-nft.dto';
import { UpdateNftMetadataDto } from '../dtos/update-nft-metadata.dto';
import { CreateSaleDto } from '../dtos/create-sale.dto';

describe('DeveloperNftController', () => {
  let controller: DeveloperNftController;
  let mockMintUseCase: jest.Mocked<MintNftUseCase>;
  let mockBurnUseCase: jest.Mocked<BurnNftUseCase>;
  let mockTransferUseCase: jest.Mocked<TransferNftUseCase>;
  let mockUpdateMetadataUseCase: jest.Mocked<UpdateNftMetadataUseCase>;
  let mockCreateSaleUseCase: jest.Mocked<CreateSaleUseCase>;

  const mockOperation = new DeveloperNftOperation(
    '456e7890-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174000',
    NftOperationType.MINT,
    NftOperationStatus.PENDING,
    '0x123...abc',
    '1',
    1,
    { name: 'Test NFT', description: 'A test NFT' },
    null,
    null,
    null,
    new Date('2023-01-01'),
    new Date('2023-01-01'),
  );

  beforeEach(async () => {
    const mockMintUseCaseValue = {
      execute: jest.fn(),
    };
    const mockBurnUseCaseValue = {
      execute: jest.fn(),
    };
    const mockTransferUseCaseValue = {
      execute: jest.fn(),
    };
    const mockUpdateMetadataUseCaseValue = {
      execute: jest.fn(),
    };
    const mockCreateSaleUseCaseValue = {
      execute: jest.fn(),
    };
    const mockValidateApiKeyUseCaseValue = {
      execute: jest.fn(),
    };
    const mockReflectorValue = {
      get: jest.fn(),
      getAll: jest.fn(),
      getAllAndOverride: jest.fn(),
      getAllAndMerge: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeveloperNftController],
      providers: [
        {
          provide: MintNftUseCase,
          useValue: mockMintUseCaseValue,
        },
        {
          provide: BurnNftUseCase,
          useValue: mockBurnUseCaseValue,
        },
        {
          provide: TransferNftUseCase,
          useValue: mockTransferUseCaseValue,
        },
        {
          provide: UpdateNftMetadataUseCase,
          useValue: mockUpdateMetadataUseCaseValue,
        },
        {
          provide: CreateSaleUseCase,
          useValue: mockCreateSaleUseCaseValue,
        },
        {
          provide: ValidateApiKeyUseCase,
          useValue: mockValidateApiKeyUseCaseValue,
        },
        {
          provide: Reflector,
          useValue: mockReflectorValue,
        },
      ],
    }).compile();

    controller = module.get<DeveloperNftController>(DeveloperNftController);
    mockMintUseCase = module.get(MintNftUseCase);
    mockBurnUseCase = module.get(BurnNftUseCase);
    mockTransferUseCase = module.get(TransferNftUseCase);
    mockUpdateMetadataUseCase = module.get(UpdateNftMetadataUseCase);
    mockCreateSaleUseCase = module.get(CreateSaleUseCase);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('mintNft', () => {
    it('should mint an NFT successfully', async () => {
      const request = { apiKeyId: '123e4567-e89b-12d3-a456-426614174000' };
      const mintDto: MintNftDto = {
        contractAddress: '0x123...abc',
        toAddress: '0x456...def',
        metadata: { name: 'Test NFT', description: 'A test NFT' },
      };

      mockMintUseCase.execute.mockResolvedValue(mockOperation);

      const result = await controller.mintNft(mintDto, request);

      expect(result).toEqual({
        operationId: mockOperation.id,
        type: mockOperation.operationType,
        status: mockOperation.status,
        toAddress: mockOperation.toAddress,
        metadata: mockOperation.metadata,
        createdAt: mockOperation.createdAt,
      });
      expect(mockMintUseCase.execute).toHaveBeenCalledWith({
        apiKeyId: request.apiKeyId,
        contractAddress: mintDto.contractAddress,
        toAddress: mintDto.toAddress,
        metadata: mintDto.metadata,
      });
    });
  });

  describe('burnNft', () => {
    it('should burn an NFT successfully', async () => {
      const request = { apiKeyId: '123e4567-e89b-12d3-a456-426614174000' };
      const burnDto: BurnNftDto = {
        contractAddress: '0x123...abc',
        fromAddress: '0x456...def',
        tokenId: '1',
      };

      mockBurnUseCase.execute.mockResolvedValue(mockOperation);

      const result = await controller.burnNft(burnDto, request);

      expect(result).toEqual({
        operationId: mockOperation.id,
        type: mockOperation.operationType,
        status: mockOperation.status,
        tokenId: mockOperation.tokenId,
        metadata: mockOperation.metadata,
        createdAt: mockOperation.createdAt,
      });
      expect(mockBurnUseCase.execute).toHaveBeenCalledWith({
        apiKeyId: request.apiKeyId,
        contractAddress: burnDto.contractAddress,
        fromAddress: burnDto.fromAddress,
        tokenId: burnDto.tokenId,
      });
    });
  });

  describe('transferNft', () => {
    it('should transfer an NFT successfully', async () => {
      const request = { apiKeyId: '123e4567-e89b-12d3-a456-426614174000' };
      const transferDto: TransferNftDto = {
        contractAddress: '0x123...abc',
        fromAddress: '0x456...def',
        toAddress: '0x789...ghi',
        tokenId: '1',
      };

      mockTransferUseCase.execute.mockResolvedValue(mockOperation);

      const result = await controller.transferNft(transferDto, request);

      expect(result).toEqual({
        operationId: mockOperation.id,
        type: mockOperation.operationType,
        status: mockOperation.status,
        toAddress: mockOperation.toAddress,
        tokenId: mockOperation.tokenId,
        metadata: mockOperation.metadata,
        createdAt: mockOperation.createdAt,
      });
      expect(mockTransferUseCase.execute).toHaveBeenCalledWith({
        apiKeyId: request.apiKeyId,
        contractAddress: transferDto.contractAddress,
        fromAddress: transferDto.fromAddress,
        toAddress: transferDto.toAddress,
        tokenId: transferDto.tokenId,
      });
    });
  });

  describe('updateMetadata', () => {
    it('should update NFT metadata successfully', async () => {
      const request = { apiKeyId: '123e4567-e89b-12d3-a456-426614174000' };
      const updateDto: UpdateNftMetadataDto = {
        contractAddress: '0x123...abc',
        tokenId: '1',
        metadata: { name: 'Updated NFT', description: 'An updated NFT' },
      };

      mockUpdateMetadataUseCase.execute.mockResolvedValue(mockOperation);

      const result = await controller.updateMetadata(updateDto, request);

      expect(result).toEqual({
        operationId: mockOperation.id,
        type: mockOperation.operationType,
        status: mockOperation.status,
        tokenId: mockOperation.tokenId,
        metadata: mockOperation.metadata,
        createdAt: mockOperation.createdAt,
      });
      expect(mockUpdateMetadataUseCase.execute).toHaveBeenCalledWith({
        apiKeyId: request.apiKeyId,
        contractAddress: updateDto.contractAddress,
        tokenId: updateDto.tokenId,
        metadata: updateDto.metadata,
      });
    });
  });

  describe('createSale', () => {
    it('should create a sale successfully', async () => {
      const request = { apiKeyId: '123e4567-e89b-12d3-a456-426614174000' };
      const saleDto: CreateSaleDto = {
        contractAddress: '0x123...abc',
        tokenId: '1',
        fromAddress: '0x456...def',
        price: '100',
        currency: 'ETH',
      };

      mockCreateSaleUseCase.execute.mockResolvedValue(mockOperation);

      const result = await controller.createSale(saleDto, request);

      expect(result).toEqual({
        operationId: mockOperation.id,
        type: mockOperation.operationType,
        status: mockOperation.status,
        tokenId: mockOperation.tokenId,
        metadata: mockOperation.metadata,
        createdAt: mockOperation.createdAt,
      });
      expect(mockCreateSaleUseCase.execute).toHaveBeenCalledWith({
        apiKeyId: request.apiKeyId,
        contractAddress: saleDto.contractAddress,
        tokenId: saleDto.tokenId,
        fromAddress: saleDto.fromAddress,
        price: 100,
        currency: saleDto.currency,
      });
    });
  });

  describe('error handling', () => {
    it('should handle mint errors', async () => {
      const request = { apiKeyId: '123e4567-e89b-12d3-a456-426614174000' };
      const mintDto: MintNftDto = {
        contractAddress: '0x123...abc',
        toAddress: '0x456...def',
        metadata: { name: 'Test NFT' },
      };

      mockMintUseCase.execute.mockRejectedValue(new Error('Database error'));

      await expect(controller.mintNft(mintDto, request)).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle burn errors', async () => {
      const request = { apiKeyId: '123e4567-e89b-12d3-a456-426614174000' };
      const burnDto: BurnNftDto = {
        contractAddress: '0x123...abc',
        fromAddress: '0x456...def',
        tokenId: '1',
      };

      mockBurnUseCase.execute.mockRejectedValue(new Error('API Key not found'));

      await expect(controller.burnNft(burnDto, request)).rejects.toThrow(
        'API Key not found',
      );
    });
  });
});
