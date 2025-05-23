/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { UserRepository } from './user.repository';
import { UserEntity, UserProps } from '../../domain/entities/user.entity';
import {
  User as DbUser,
  Database,
  NewUser,
  UserUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';
import { sql } from 'kysely';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid'),
}));

jest.mock('kysely', () => ({
  ...jest.requireActual('kysely'),
  sql: jest.fn(),
}));

const mockSql = sql as jest.MockedFunction<typeof sql>;

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockDb: jest.Mocked<Kysely<Database>>;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockBaseRepository: jest.Mocked<
    BaseRepository<'users', DbUser, NewUser, UserUpdate>
  >;

  const mockDbUser: DbUser = {
    id: 'test-id',
    privy_id: 'test-privy-id',
    wallet_address: 'test-wallet',
    email: 'test@example.com',
    phone_number: '+1234567890',
    is_active: true,
    created_at: new Date('2023-01-01'),
    updated_at: new Date('2023-01-02'),
  };

  const mockUserProps: UserProps = {
    id: 'test-id',
    privyId: 'test-privy-id',
    walletAddress: 'test-wallet',
    email: 'test@example.com',
    phoneNumber: '+1234567890',
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
  };

  beforeEach(async () => {
    mockDb = {} as any;

    mockBaseRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockRepositoryFactory = {
      createRepository: jest.fn().mockReturnValue(mockBaseRepository),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
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

    repository = module.get<UserRepository>(UserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByPrivyId', () => {
    it('should return user entity when user is found', async () => {
      const mockExecuteResult = {
        rows: [mockDbUser],
        numAffectedRows: BigInt(1),
        insertId: BigInt(0),
      };

      const mockExecute = jest.fn().mockResolvedValue(mockExecuteResult);
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      const result = await repository.findByPrivyId('test-privy-id');

      expect(result).toBeInstanceOf(UserEntity);
      expect(result?.id).toBe('test-id');
      expect(result?.privyId).toBe('test-privy-id');
      expect(result?.walletAddress).toBe('test-wallet');
      expect(result?.email).toBe('test@example.com');
      expect(result?.phoneNumber).toBe('+1234567890');
      expect(result?.isActive).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith(mockDb);
    });

    it('should return null when user is not found', async () => {
      const mockExecuteResult = {
        rows: [],
        numAffectedRows: BigInt(0),
        insertId: BigInt(0),
      };

      const mockExecute = jest.fn().mockResolvedValue(mockExecuteResult);
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      const result = await repository.findByPrivyId('non-existent-privy-id');

      expect(result).toBeNull();
      expect(mockExecute).toHaveBeenCalledWith(mockDb);
    });

    it('should handle database errors', async () => {
      const mockExecute = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      await expect(repository.findByPrivyId('test-privy-id')).rejects.toThrow(
        'Database error',
      );
      expect(mockExecute).toHaveBeenCalledWith(mockDb);
    });
  });

  describe('findById', () => {
    it('should return user entity when user is found', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockDbUser);

      const result = await repository.findById('test-id');

      expect(result).toBeInstanceOf(UserEntity);
      expect(result?.id).toBe('test-id');
      expect(result?.privyId).toBe('test-privy-id');
      expect(mockBaseRepository.findById).toHaveBeenCalledWith('test-id');
    });

    it('should return null when user is not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
      expect(mockBaseRepository.findById).toHaveBeenCalledWith(
        'non-existent-id',
      );
    });

    it('should handle database errors', async () => {
      mockBaseRepository.findById.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(repository.findById('test-id')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('save', () => {
    it('should update and return user entity', async () => {
      const userEntity = new UserEntity(mockUserProps);
      const updatedDbUser = { ...mockDbUser, wallet_address: 'updated-wallet' };

      const mockExecuteResult = {
        rows: [updatedDbUser],
        numAffectedRows: BigInt(1),
        insertId: BigInt(0),
      };

      const mockExecute = jest.fn().mockResolvedValue(mockExecuteResult);
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      const result = await repository.save(userEntity);

      expect(result).toBeInstanceOf(UserEntity);
      expect(result.id).toBe('test-id');
      expect(mockExecute).toHaveBeenCalledWith(mockDb);
    });

    it('should throw error when user is not found for update', async () => {
      const userEntity = new UserEntity(mockUserProps);

      const mockExecuteResult = {
        rows: [],
        numAffectedRows: BigInt(0),
        insertId: BigInt(0),
      };

      const mockExecute = jest.fn().mockResolvedValue(mockExecuteResult);
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      await expect(repository.save(userEntity)).rejects.toThrow(
        'User not found for update',
      );
      expect(mockExecute).toHaveBeenCalledWith(mockDb);
    });

    it('should handle database errors during update', async () => {
      const userEntity = new UserEntity(mockUserProps);

      const mockExecute = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      await expect(repository.save(userEntity)).rejects.toThrow(
        'Database error',
      );
      expect(mockExecute).toHaveBeenCalledWith(mockDb);
    });
  });

  describe('create', () => {
    it('should create and return new user entity', async () => {
      const userData = {
        privyId: 'new-privy-id',
        walletAddress: 'new-wallet',
        email: 'new@example.com',
        phoneNumber: '+9876543210',
        isActive: true,
      };

      const expectedNewUser: NewUser = {
        id: 'mocked-uuid',
        privy_id: 'new-privy-id',
        wallet_address: 'new-wallet',
        email: 'new@example.com',
        phone_number: '+9876543210',
        is_active: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      };

      const createdDbUser: DbUser = {
        id: 'mocked-uuid',
        privy_id: 'new-privy-id',
        wallet_address: 'new-wallet',
        email: 'new@example.com',
        phone_number: '+9876543210',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockBaseRepository.create.mockResolvedValue(createdDbUser);

      const result = await repository.create(userData);

      expect(result).toBeInstanceOf(UserEntity);
      expect(result.id).toBe('mocked-uuid');
      expect(result.privyId).toBe('new-privy-id');
      expect(result.walletAddress).toBe('new-wallet');
      expect(result.email).toBe('new@example.com');
      expect(result.phoneNumber).toBe('+9876543210');
      expect(result.isActive).toBe(true);
      expect(mockBaseRepository.create).toHaveBeenCalledWith(expectedNewUser);
    });

    it('should create user with optional fields as null', async () => {
      const userData = {
        privyId: 'new-privy-id',
        isActive: true,
      };

      const expectedNewUser: NewUser = {
        id: 'mocked-uuid',
        privy_id: 'new-privy-id',
        wallet_address: null,
        email: null,
        phone_number: null,
        is_active: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      };

      const createdDbUser: DbUser = {
        id: 'mocked-uuid',
        privy_id: 'new-privy-id',
        wallet_address: null,
        email: null,
        phone_number: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockBaseRepository.create.mockResolvedValue(createdDbUser);

      const result = await repository.create(userData);

      expect(result).toBeInstanceOf(UserEntity);
      expect(result.walletAddress).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.phoneNumber).toBeUndefined();
      expect(mockBaseRepository.create).toHaveBeenCalledWith(expectedNewUser);
    });

    it('should handle database errors during creation', async () => {
      const userData = {
        privyId: 'new-privy-id',
        isActive: true,
      };

      mockBaseRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(repository.create(userData)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('toDomainEntity', () => {
    it('should convert database user to domain entity with all fields', () => {
      const result = (repository as any).toDomainEntity(mockDbUser);

      expect(result).toBeInstanceOf(UserEntity);
      expect(result.id).toBe('test-id');
      expect(result.privyId).toBe('test-privy-id');
      expect(result.walletAddress).toBe('test-wallet');
      expect(result.email).toBe('test@example.com');
      expect(result.phoneNumber).toBe('+1234567890');
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toEqual(new Date('2023-01-01'));
      expect(result.updatedAt).toEqual(new Date('2023-01-02'));
    });

    it('should convert database user to domain entity with null optional fields', () => {
      const dbUserWithNulls: DbUser = {
        ...mockDbUser,
        wallet_address: null,
        email: null,
        phone_number: null,
      };

      const result = (repository as any).toDomainEntity(dbUserWithNulls);

      expect(result).toBeInstanceOf(UserEntity);
      expect(result.walletAddress).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.phoneNumber).toBeUndefined();
    });
  });

  describe('constructor', () => {
    it('should initialize repository with correct factory call', () => {
      expect(mockRepositoryFactory.createRepository).toHaveBeenCalledWith(
        'users',
      );
    });
  });
});
