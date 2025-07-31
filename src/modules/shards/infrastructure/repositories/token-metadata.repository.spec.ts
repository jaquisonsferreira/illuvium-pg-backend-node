import { Test, TestingModule } from '@nestjs/testing';
import { TokenMetadataRepository } from './token-metadata.repository';
import { TokenMetadataEntity } from '../../domain/entities/token-metadata.entity';
import {
  TokenMetadata as DbTokenMetadata,
  RepositoryFactory,
  DATABASE_CONNECTION,
} from '@shared/infrastructure/database';

describe('TokenMetadataRepository', () => {
  let repository: TokenMetadataRepository;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockBaseRepository: any;
  let mockDb: any;

  const mockDbTokenMetadata: DbTokenMetadata = {
    id: '1',
    token_address: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    total_supply: '120000000000000000000000000',
    circulating_supply: '118000000000000000000000000',
    coingecko_id: 'ethereum',
    is_lp_token: false,
    token0_address: null,
    token1_address: null,
    pool_address: null,
    dex_name: null,
    logo_url: 'https://example.com/eth-logo.png',
    contract_type: 'ERC20',
    is_verified: true,
    last_updated: new Date('2024-01-15T12:00:00.000Z'),
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-15T12:00:00.000Z'),
  };

  const mockDbLpToken: DbTokenMetadata = {
    id: '2',
    token_address: '0xabcdef1234567890abcdef1234567890abcdef12',
    chain: 'ethereum',
    symbol: 'ETH-USDC-LP',
    name: 'Ethereum-USDC LP Token',
    decimals: 18,
    total_supply: '10000000000000000000000',
    circulating_supply: '10000000000000000000000',
    coingecko_id: null,
    is_lp_token: true,
    token0_address: '0x1234567890abcdef1234567890abcdef12345678',
    token1_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    pool_address: '0xpool1234567890abcdef1234567890abcdef1234',
    dex_name: 'uniswap-v2',
    logo_url: null,
    contract_type: 'UniswapV2Pair',
    is_verified: false,
    last_updated: new Date('2024-01-15T12:00:00.000Z'),
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-15T12:00:00.000Z'),
  };

  beforeEach(async () => {
    mockBaseRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    };

    mockRepositoryFactory = {
      createRepository: jest.fn().mockReturnValue(mockBaseRepository),
    } as any;

    mockDb = {
      selectFrom: jest.fn(),
      insertInto: jest.fn(),
      updateTable: jest.fn(),
      deleteFrom: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenMetadataRepository,
        {
          provide: RepositoryFactory,
          useValue: mockRepositoryFactory,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<TokenMetadataRepository>(TokenMetadataRepository);
  });

  describe('findById', () => {
    it('should find token metadata by id', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockDbTokenMetadata);

      const result = await repository.findById('1');

      expect(mockBaseRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toBeInstanceOf(TokenMetadataEntity);
      expect(result?.id).toBe('1');
      expect(result?.symbol).toBe('ETH');
      expect(result?.decimals).toBe(18);
    });

    it('should return null when token not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('findByAddress', () => {
    it('should find token by address and chain', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbTokenMetadata),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByAddress(
        '0x1234567890ABCDEF1234567890ABCDEF12345678', // uppercase to test toLowerCase
        'ethereum',
      );

      expect(mockDb.selectFrom).toHaveBeenCalledWith('token_metadata');
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'token_address',
        '=',
        '0x1234567890abcdef1234567890abcdef12345678', // should be lowercase
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'chain',
        '=',
        'ethereum',
      );
      expect(result).toBeInstanceOf(TokenMetadataEntity);
    });

    it('should return null when token not found', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(null),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByAddress(
        '0xnonexistent',
        'ethereum',
      );

      expect(result).toBeNull();
    });
  });

  describe('findBySymbol', () => {
    it('should find tokens by symbol', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbTokenMetadata]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findBySymbol('ETH');

      expect(mockSelectFrom.where).toHaveBeenCalledWith('symbol', '=', 'ETH');
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(TokenMetadataEntity);
    });

    it('should filter by chain when provided', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbTokenMetadata]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findBySymbol('ETH', 'ethereum');

      expect(mockSelectFrom.where).toHaveBeenCalledWith('symbol', '=', 'ETH');
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'chain',
        '=',
        'ethereum',
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findByCoingeckoId', () => {
    it('should find token by coingecko id', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbTokenMetadata),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByCoingeckoId('ethereum');

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'coingecko_id',
        '=',
        'ethereum',
      );
      expect(result).toBeInstanceOf(TokenMetadataEntity);
    });
  });

  describe('findLpTokens', () => {
    it('should find all LP tokens', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbLpToken]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findLpTokens();

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'is_lp_token',
        '=',
        true,
      );
      expect(result).toHaveLength(1);
      expect(result[0].isLpToken).toBe(true);
    });

    it('should filter by chain when provided', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbLpToken]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findLpTokens('ethereum');

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'is_lp_token',
        '=',
        true,
      );
      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'chain',
        '=',
        'ethereum',
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findByPoolAddress', () => {
    it('should find token by pool address', async () => {
      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockDbLpToken),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findByPoolAddress(
        '0xPOOL1234567890ABCDEF1234567890ABCDEF1234', // uppercase to test toLowerCase
        'ethereum',
      );

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'pool_address',
        '=',
        '0xpool1234567890abcdef1234567890abcdef1234', // should be lowercase
      );
      expect(result).toBeInstanceOf(TokenMetadataEntity);
      expect(result?.isLpToken).toBe(true);
    });
  });

  describe('findStaleTokens', () => {
    it('should find stale tokens', async () => {
      const lastUpdatedBefore = new Date('2024-01-01');
      const limit = 10;

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbTokenMetadata]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.findStaleTokens(lastUpdatedBefore, limit);

      expect(mockSelectFrom.where).toHaveBeenCalledWith(
        'last_updated',
        '<',
        lastUpdatedBefore,
      );
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith(
        'last_updated',
        'asc',
      );
      expect(mockSelectFrom.limit).toHaveBeenCalledWith(limit);
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should create a new token metadata', async () => {
      const newToken = TokenMetadataEntity.create({
        tokenAddress: '0xnewtoken',
        chain: 'ethereum',
        symbol: 'NEW',
        name: 'New Token',
        decimals: 18,
        totalSupply: '1000000000000000000000000',
        coingeckoId: 'new-token',
        isVerified: true,
      });

      const dbToken = {
        ...mockDbTokenMetadata,
        id: newToken.id,
        token_address: '0xnewtoken',
        symbol: 'NEW',
        name: 'New Token',
      };

      mockBaseRepository.create.mockResolvedValue(dbToken);

      const result = await repository.create(newToken);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        id: newToken.id,
        token_address: '0xnewtoken',
        chain: 'ethereum',
        symbol: 'NEW',
        name: 'New Token',
        decimals: 18,
        total_supply: '1000000000000000000000000',
        circulating_supply: null,
        coingecko_id: 'new-token',
        is_lp_token: false,
        token0_address: null,
        token1_address: null,
        pool_address: null,
        dex_name: null,
        logo_url: null,
        contract_type: null,
        is_verified: true,
        last_updated: newToken.lastUpdated,
      });
      expect(result).toBeInstanceOf(TokenMetadataEntity);
      expect(result.symbol).toBe('NEW');
    });
  });

  describe('createBatch', () => {
    it('should create multiple token metadata', async () => {
      const tokens = [
        TokenMetadataEntity.create({
          tokenAddress: '0xtoken1',
          chain: 'ethereum',
          symbol: 'TOK1',
          name: 'Token 1',
          decimals: 18,
        }),
        TokenMetadataEntity.create({
          tokenAddress: '0xtoken2',
          chain: 'base',
          symbol: 'TOK2',
          name: 'Token 2',
          decimals: 6,
        }),
      ];

      const mockInsertInto = {
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.insertInto.mockReturnValue(mockInsertInto);

      await repository.createBatch(tokens);

      expect(mockDb.insertInto).toHaveBeenCalledWith('token_metadata');
      expect(mockInsertInto.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            token_address: '0xtoken1',
            symbol: 'TOK1',
          }),
          expect.objectContaining({
            token_address: '0xtoken2',
            symbol: 'TOK2',
          }),
        ]),
      );
    });

    it('should handle empty batch', async () => {
      await repository.createBatch([]);

      expect(mockDb.insertInto).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update token metadata', async () => {
      const tokenToUpdate = new TokenMetadataEntity(
        '1',
        '0x1234567890abcdef1234567890abcdef12345678',
        'ethereum',
        'ETH',
        'Ethereum',
        18,
        '121000000000000000000000000', // Updated total supply
        '119000000000000000000000000', // Updated circulating supply
        'ethereum',
        false,
        null,
        null,
        null,
        null,
        'https://example.com/eth-logo-new.png',
        'ERC20',
        true,
        new Date(),
        new Date('2024-01-01'),
        new Date(),
      );

      const mockUpdateTable = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returningAll: jest.fn().mockReturnThis(),
        executeTakeFirstOrThrow: jest.fn().mockResolvedValue({
          ...mockDbTokenMetadata,
          total_supply: '121000000000000000000000000',
          circulating_supply: '119000000000000000000000000',
        }),
      };
      mockDb.updateTable.mockReturnValue(mockUpdateTable);

      const result = await repository.update(tokenToUpdate);

      expect(mockDb.updateTable).toHaveBeenCalledWith('token_metadata');
      expect(mockUpdateTable.set).toHaveBeenCalledWith(
        expect.objectContaining({
          total_supply: '121000000000000000000000000',
          circulating_supply: '119000000000000000000000000',
        }),
      );
      expect(mockUpdateTable.where).toHaveBeenCalledWith('id', '=', '1');
      expect(result).toBeInstanceOf(TokenMetadataEntity);
    });
  });

  describe('upsert', () => {
    it('should upsert token metadata', async () => {
      const token = TokenMetadataEntity.create({
        tokenAddress: '0xtoken',
        chain: 'ethereum',
        symbol: 'TOK',
        name: 'Token',
        decimals: 18,
      });

      const mockInsertInto = {
        values: jest.fn().mockReturnThis(),
        onConflict: jest.fn(),
        returningAll: jest.fn().mockReturnThis(),
        executeTakeFirstOrThrow: jest.fn().mockResolvedValue({
          ...mockDbTokenMetadata,
          symbol: 'TOK',
        }),
      };

      // onConflict should return the insert query to allow chaining
      mockInsertInto.onConflict.mockImplementation((callback) => {
        const conflictBuilder = {
          columns: jest.fn().mockReturnThis(),
          doUpdateSet: jest.fn().mockReturnValue(mockInsertInto), // Return the insert query
        };
        callback(conflictBuilder);
        return mockInsertInto;
      });

      mockDb.insertInto.mockReturnValue(mockInsertInto);

      const result = await repository.upsert(token);

      expect(mockInsertInto.onConflict).toHaveBeenCalled();
      expect(result).toBeInstanceOf(TokenMetadataEntity);
    });
  });

  describe('updateLastUpdated', () => {
    it('should update last updated timestamp', async () => {
      const timestamp = new Date('2024-01-20');

      const mockUpdateTable = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.updateTable.mockReturnValue(mockUpdateTable);

      await repository.updateLastUpdated(
        '0xTOKEN1234567890ABCDEF',
        'ethereum',
        timestamp,
      );

      expect(mockUpdateTable.set).toHaveBeenCalledWith({
        last_updated: timestamp,
        updated_at: expect.any(Date),
      });
      expect(mockUpdateTable.where).toHaveBeenCalledWith(
        'token_address',
        '=',
        '0xtoken1234567890abcdef',
      );
      expect(mockUpdateTable.where).toHaveBeenCalledWith(
        'chain',
        '=',
        'ethereum',
      );
    });
  });

  describe('searchTokens', () => {
    it('should search tokens by query', async () => {
      const query = 'ETH';
      const limit = 10;

      const mockSelectFrom = {
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockDbTokenMetadata]),
      };
      mockDb.selectFrom.mockReturnValue(mockSelectFrom);

      const result = await repository.searchTokens(query, limit);

      expect(mockSelectFrom.where).toHaveBeenCalledWith(expect.any(Function));
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith(
        'is_verified',
        'desc',
      );
      expect(mockSelectFrom.orderBy).toHaveBeenCalledWith('symbol', 'asc');
      expect(mockSelectFrom.limit).toHaveBeenCalledWith(limit);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(TokenMetadataEntity);
    });
  });
});
