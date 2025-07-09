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
  let mockDb: any;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockBaseRepository: jest.Mocked<
    BaseRepository<'users', DbUser, NewUser, UserUpdate>
  >;

  const mockDbUser: DbUser = {
    id: 'test-id',
    privy_id: 'test-privy-id',
    nickname: 'testuser',
    avatar_url: 'https://example.com/avatar.jpg',
    experiments: null,
    social_bluesky: null,
    social_discord: null,
    social_instagram: null,
    social_farcaster: null,
    social_twitch: null,
    social_youtube: null,
    social_x: null,
    is_active: true,
    created_at: new Date('2023-01-01'),
    updated_at: new Date('2023-01-02'),
  };

  const mockUserProps: UserProps = {
    id: 'test-id',
    privyId: 'test-privy-id',
    nickname: 'testuser',
    avatarUrl: 'https://example.com/avatar.jpg',
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
  };

  beforeEach(async () => {
    mockDb = {};

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
      expect(result?.nickname).toBe('testuser');
      expect(result?.avatarUrl).toBe('https://example.com/avatar.jpg');
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
        nickname: 'newuser',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        isActive: true,
      };

      const createdDbUser: DbUser = {
        id: 'mocked-uuid',
        privy_id: 'new-privy-id',
        nickname: 'newuser',
        avatar_url: 'https://example.com/new-avatar.jpg',
        experiments: null,
        social_bluesky: null,
        social_discord: null,
        social_instagram: null,
        social_farcaster: null,
        social_twitch: null,
        social_youtube: null,
        social_x: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockExecute = jest.fn().mockResolvedValue({
        rows: [createdDbUser],
      });
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      const result = await repository.create(userData);

      expect(result).toBeInstanceOf(UserEntity);
      expect(result.id).toBe('mocked-uuid');
      expect(result.privyId).toBe('new-privy-id');
      expect(result.nickname).toBe('newuser');
      expect(result.avatarUrl).toBe('https://example.com/new-avatar.jpg');
      expect(result.isActive).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith(mockDb);
      expect(mockSql).toHaveBeenCalled();
    });

    it('should create user with optional fields as null', async () => {
      const userData = {
        privyId: 'new-privy-id',
        isActive: true,
      };

      const createdDbUser: DbUser = {
        id: 'mocked-uuid',
        privy_id: 'new-privy-id',
        nickname: null,
        avatar_url: null,
        experiments: null,
        social_bluesky: null,
        social_discord: null,
        social_instagram: null,
        social_farcaster: null,
        social_twitch: null,
        social_youtube: null,
        social_x: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockExecute = jest.fn().mockResolvedValue({
        rows: [createdDbUser],
      });
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      const result = await repository.create(userData);

      expect(result).toBeInstanceOf(UserEntity);
      expect(result.nickname).toBeUndefined();
      expect(result.avatarUrl).toBeUndefined();
      expect(mockExecute).toHaveBeenCalledWith(mockDb);
      expect(mockSql).toHaveBeenCalled();
    });

    it('should handle database errors during creation', async () => {
      const userData = {
        privyId: 'new-privy-id',
        isActive: true,
      };

      const mockExecute = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));
      mockSql.mockReturnValue({
        execute: mockExecute,
      } as any);

      await expect(repository.create(userData)).rejects.toThrow(
        'Database error',
      );
      expect(mockExecute).toHaveBeenCalledWith(mockDb);
    });
  });

  describe('toDomainEntity', () => {
    it('should convert database user to domain entity with all fields', () => {
      const result = (repository as any).toDomainEntity(mockDbUser);

      expect(result).toBeInstanceOf(UserEntity);
      expect(result.id).toBe('test-id');
      expect(result.privyId).toBe('test-privy-id');
      expect(result.nickname).toBe('testuser');
      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toEqual(new Date('2023-01-01'));
      expect(result.updatedAt).toEqual(new Date('2023-01-02'));
    });

    it('should convert database user to domain entity with null optional fields', () => {
      const dbUserWithNulls: DbUser = {
        ...mockDbUser,
        nickname: null,
        avatar_url: null,
      };

      const result = (repository as any).toDomainEntity(dbUserWithNulls);

      expect(result).toBeInstanceOf(UserEntity);
      expect(result.nickname).toBeUndefined();
      expect(result.avatarUrl).toBeUndefined();
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
