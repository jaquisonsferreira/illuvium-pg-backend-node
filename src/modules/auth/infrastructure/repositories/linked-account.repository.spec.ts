import { Test, TestingModule } from '@nestjs/testing';
import { LinkedAccountRepository } from './linked-account.repository';
import { DATABASE_CONNECTION } from '@shared/infrastructure/database';
import { Kysely } from 'kysely';
import { Database } from '@shared/infrastructure/database/database.types';
import { LinkedAccountEntity } from '../../domain/entities/linked-account.entity';
import { sql } from 'kysely';

jest.mock('kysely', () => ({
  ...jest.requireActual('kysely'),
  sql: jest.fn(),
}));

const mockSql = sql as jest.MockedFunction<typeof sql>;

describe('LinkedAccountRepository', () => {
  let repository: LinkedAccountRepository;
  let mockDb: jest.Mocked<Kysely<Database>>;

  const mockLinkedAccountData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    owner: 'user123',
    type: 'wallet',
    identifier: '0x1234567890123456789012345678901234567890',
    email_address: null,
    label: 'My Wallet',
    created_at: new Date('2023-01-01T00:00:00.000Z'),
    updated_at: new Date('2023-01-01T00:00:00.000Z'),
  };

  const mockLinkedAccountEntity = new LinkedAccountEntity({
    owner: 'user123',
    type: 'wallet',
    identifier: '0x1234567890123456789012345678901234567890',
    label: 'My Wallet',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  });

  beforeEach(async () => {
    const mockQueryBuilder = {
      selectFrom: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      executeTakeFirst: jest.fn(),
      executeTakeFirstOrThrow: jest.fn(),
      insertInto: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      doUpdateSet: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      returningAll: jest.fn().mockReturnThis(),
      deleteFrom: jest.fn().mockReturnThis(),
    };

    const mockDatabase = {
      selectFrom: jest.fn().mockReturnValue(mockQueryBuilder),
      insertInto: jest.fn().mockReturnValue(mockQueryBuilder),
      deleteFrom: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkedAccountRepository,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDatabase,
        },
      ],
    }).compile();

    repository = module.get<LinkedAccountRepository>(LinkedAccountRepository);
    mockDb = module.get(DATABASE_CONNECTION);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByOwner', () => {
    it('should return linked accounts for a user', async () => {
      const mockExecute = jest.fn().mockResolvedValue({
        rows: [mockLinkedAccountData],
      });
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      const result = await repository.findByOwner('user123');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(LinkedAccountEntity);
      expect(result[0].owner).toBe('user123');
      expect(mockExecute).toHaveBeenCalledWith(mockDb);
    });

    it('should return empty array when no accounts found', async () => {
      const mockExecute = jest.fn().mockResolvedValue({
        rows: [],
      });
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      const result = await repository.findByOwner('user123');

      expect(result).toEqual([]);
    });
  });

  describe('findByTypeAndIdentifier', () => {
    it('should return linked account by type and identifier', async () => {
      const mockQueryBuilder = mockDb.selectFrom('linked_accounts') as any;
      mockQueryBuilder.executeTakeFirst.mockResolvedValue(
        mockLinkedAccountData,
      );

      const result = await repository.findByTypeAndIdentifier(
        'wallet',
        '0x1234567890123456789012345678901234567890',
      );

      expect(result).toBeInstanceOf(LinkedAccountEntity);
      expect(result?.type).toBe('wallet');
      expect(result?.identifier).toBe(
        '0x1234567890123456789012345678901234567890',
      );
      expect(mockDb.selectFrom).toHaveBeenCalledWith('linked_accounts');
      expect(mockQueryBuilder.selectAll).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'type',
        '=',
        'wallet',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'identifier',
        '=',
        '0x1234567890123456789012345678901234567890',
      );
    });

    it('should return null when account not found', async () => {
      const mockQueryBuilder = mockDb.selectFrom('linked_accounts') as any;
      mockQueryBuilder.executeTakeFirst.mockResolvedValue(undefined);

      const result = await repository.findByTypeAndIdentifier(
        'wallet',
        'nonexistent',
      );

      expect(result).toBeNull();
    });
  });

  describe('findWalletsByOwner', () => {
    it('should return wallet accounts for a user', async () => {
      const mockQueryBuilder = mockDb.selectFrom('linked_accounts') as any;
      mockQueryBuilder.execute.mockResolvedValue([mockLinkedAccountData]);

      const result = await repository.findWalletsByOwner('user123');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(LinkedAccountEntity);
      expect(mockDb.selectFrom).toHaveBeenCalledWith('linked_accounts');
      expect(mockQueryBuilder.selectAll).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'owner',
        '=',
        'user123',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'type',
        '=',
        'wallet',
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'created_at',
        'asc',
      );
    });
  });

  describe('findEmailByOwner', () => {
    it('should return email account for a user', async () => {
      const emailData = {
        ...mockLinkedAccountData,
        type: 'email',
        identifier: 'test@example.com',
        email_address: 'test@example.com',
      };
      const mockQueryBuilder = mockDb.selectFrom('linked_accounts') as any;
      mockQueryBuilder.executeTakeFirst.mockResolvedValue(emailData);

      const result = await repository.findEmailByOwner('user123');

      expect(result).toBeInstanceOf(LinkedAccountEntity);
      expect(result?.type).toBe('email');
      expect(mockDb.selectFrom).toHaveBeenCalledWith('linked_accounts');
      expect(mockQueryBuilder.selectAll).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'owner',
        '=',
        'user123',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('type', '=', 'email');
    });

    it('should return null when no email account found', async () => {
      const mockQueryBuilder = mockDb.selectFrom('linked_accounts') as any;
      mockQueryBuilder.executeTakeFirst.mockResolvedValue(undefined);

      const result = await repository.findEmailByOwner('user123');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should save a new linked account', async () => {
      const mockQueryBuilder = mockDb.insertInto('linked_accounts') as any;
      mockQueryBuilder.executeTakeFirstOrThrow.mockResolvedValue(
        mockLinkedAccountData,
      );

      const result = await repository.save(mockLinkedAccountEntity);

      expect(result).toBeInstanceOf(LinkedAccountEntity);
      expect(mockDb.insertInto).toHaveBeenCalledWith('linked_accounts');
      expect(mockQueryBuilder.values).toHaveBeenCalledWith({
        owner: 'user123',
        type: 'wallet',
        identifier: '0x1234567890123456789012345678901234567890',
        email_address: null,
        label: 'My Wallet',
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('should update existing linked account on conflict', async () => {
      const mockConflictBuilder = {
        columns: jest.fn().mockReturnThis(),
        doUpdateSet: jest.fn().mockReturnThis(),
      };
      const mockQueryBuilder = mockDb.insertInto('linked_accounts') as any;
      mockQueryBuilder.onConflict.mockImplementation((callback) => {
        callback(mockConflictBuilder);
        return mockQueryBuilder;
      });
      mockQueryBuilder.executeTakeFirstOrThrow.mockResolvedValue({
        ...mockLinkedAccountData,
        updated_at: new Date(),
      });

      const result = await repository.save(mockLinkedAccountEntity);

      expect(result).toBeInstanceOf(LinkedAccountEntity);
      expect(mockQueryBuilder.onConflict).toHaveBeenCalled();
      expect(mockConflictBuilder.columns).toHaveBeenCalledWith([
        'owner',
        'type',
        'identifier',
      ]);
      expect(mockConflictBuilder.doUpdateSet).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a linked account', async () => {
      const mockQueryBuilder = mockDb.deleteFrom('linked_accounts') as any;
      mockQueryBuilder.execute.mockResolvedValue({ numDeletedRows: BigInt(1) });

      await repository.delete(
        'user123',
        'wallet',
        '0x1234567890123456789012345678901234567890',
      );

      expect(mockDb.deleteFrom).toHaveBeenCalledWith('linked_accounts');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'owner',
        '=',
        'user123',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'type',
        '=',
        'wallet',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'identifier',
        '=',
        '0x1234567890123456789012345678901234567890',
      );
    });
  });

  describe('deleteAllByOwner', () => {
    it('should delete all linked accounts for a user', async () => {
      const mockQueryBuilder = mockDb.deleteFrom('linked_accounts') as any;
      mockQueryBuilder.execute.mockResolvedValue({ numDeletedRows: BigInt(2) });

      await repository.deleteAllByOwner('user123');

      expect(mockDb.deleteFrom).toHaveBeenCalledWith('linked_accounts');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'owner',
        '=',
        'user123',
      );
    });
  });
});
