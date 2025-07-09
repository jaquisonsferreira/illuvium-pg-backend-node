import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { RoomRepository } from './room.repository';
import { Room } from '../../domain/entities/room.entity';
import {
  RepositoryFactory,
  DATABASE_CONNECTION,
} from '@shared/infrastructure/database';

describe('RoomRepository', () => {
  let repository: RoomRepository;
  let mockRepositoryFactory: jest.Mocked<RepositoryFactory>;
  let mockDb: any;
  let mockBaseRepository: any;

  beforeEach(async () => {
    mockBaseRepository = createMock({
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    });

    mockRepositoryFactory = createMock<RepositoryFactory>();
    mockRepositoryFactory.createRepository.mockReturnValue(mockBaseRepository);

    mockDb = createMock({
      selectFrom: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      insertInto: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      executeTakeFirstOrThrow: jest.fn(),
      updateTable: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      executeTakeFirst: jest.fn(),
      deleteFrom: jest.fn().mockReturnThis(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomRepository,
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

    repository = module.get<RoomRepository>(RoomRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findById', () => {
    it('should find room by id', async () => {
      const mockDbRoom = {
        id: 'room-1',
        name: 'Test Room',
        type: 'group' as const,
        description: 'Test description',
        owner_id: 'user-1',
        is_private: false,
        max_participants: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockBaseRepository.findById.mockResolvedValue(mockDbRoom);

      const result = await repository.findById('room-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('room-1');
      expect(result?.name).toBe('Test Room');
      expect(result?.type).toBe('group');
      expect(mockBaseRepository.findById).toHaveBeenCalledWith('room-1');
    });

    it('should return null if room not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find rooms by user id', async function (this: void) {
      const mockDbRooms = [
        {
          id: 'room-1',
          name: 'Room 1',
          type: 'group' as const,
          description: 'Test room 1',
          owner_id: 'user-1',
          is_private: false,
          max_participants: 10,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'room-2',
          name: 'Room 2',
          type: 'direct' as const,
          description: null,
          owner_id: 'user-1',
          is_private: true,
          max_participants: 2,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      // Mock the query builder chain for Kysely
      const mockExecute = jest.fn().mockResolvedValue(mockDbRooms);
      mockDb.selectFrom.mockReturnValue({
        selectAll: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              execute: mockExecute,
            }),
          }),
        }),
      });

      const result = await repository.findByUserId('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('room-1');
      expect(result[1].id).toBe('room-2');
    });
  });

  describe('create', () => {
    it('should create a new room', async () => {
      const roomData: Omit<Room, 'id' | 'createdAt' | 'updatedAt'> = {
        name: 'New Room',
        type: 'group',
        ownerId: 'user-1',
        isPrivate: false,
        participantIds: ['user-1', 'user-2'],
      };

      const mockCreatedRoom = {
        id: 'room-1',
        name: 'New Room',
        type: 'group' as const,
        description: null,
        owner_id: 'user-1',
        is_private: false,
        max_participants: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockBaseRepository.create.mockResolvedValue(mockCreatedRoom);

      const result = await repository.create(roomData);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        name: 'New Room',
        type: 'group',
        description: null,
        owner_id: 'user-1',
        is_private: false,
        max_participants: null,
      });
      expect(result.name).toBe('New Room');
      expect(result.type).toBe('group');
      expect(result.ownerId).toBe('user-1');
      expect(result.isPrivate).toBe(false);
    });
  });

  describe('save', () => {
    it('should save an existing room', async () => {
      const room: Room = {
        id: 'room-1',
        name: 'Updated Room',
        type: 'group',
        ownerId: 'user-1',
        isPrivate: false,
        participantIds: ['user-1', 'user-2'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdatedRoom = {
        id: 'room-1',
        name: 'Updated Room',
        type: 'group' as const,
        description: null,
        owner_id: 'user-1',
        is_private: false,
        max_participants: null,
        created_at: room.createdAt,
        updated_at: new Date(),
      };

      mockBaseRepository.update.mockResolvedValue(mockUpdatedRoom);

      const result = await repository.save(room);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Room');
    });
  });

  describe('deleteById', () => {
    it('should delete a room', async () => {
      mockBaseRepository.delete.mockResolvedValue(undefined);

      await repository.deleteById('room-1');

      expect(mockBaseRepository.delete).toHaveBeenCalledWith('room-1');
    });
  });
});
