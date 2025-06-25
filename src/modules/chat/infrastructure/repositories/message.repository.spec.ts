import { Test, TestingModule } from '@nestjs/testing';
import { MessageRepository } from './message.repository';
import { Message } from '../../domain/entities/message.entity';
import {
  RepositoryFactory,
  DATABASE_CONNECTION,
  BaseRepository,
} from '@shared/infrastructure/database';

describe('MessageRepository', () => {
  let repository: MessageRepository;
  let mockBaseRepository: jest.Mocked<BaseRepository<any, any, any, any>>;
  let mockDb: any;

  beforeEach(async () => {
    mockBaseRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    const mockRepositoryFactory = {
      createRepository: jest.fn().mockReturnValue(mockBaseRepository),
    };

    mockDb = {
      selectFrom: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      insertInto: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      executeTakeFirstOrThrow: jest.fn(),
      updateTable: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      executeTakeFirst: jest.fn(),
      deleteFrom: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageRepository,
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

    repository = module.get<MessageRepository>(MessageRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findById', () => {
    it('should find message by id', async function (this: void) {
      const mockDbMessage = {
        id: 'message-1',
        room_id: 'room-1',
        sender_id: 'user-1',
        content: 'Test message',
        type: 'text' as const,
        metadata: null,
        reply_to_id: null,
        edited_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockBaseRepository.findById.mockResolvedValue(mockDbMessage);

      const result = await repository.findById('message-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('message-1');
      expect(result?.content).toBe('Test message');
      expect(result?.type).toBe('text');
      expect(mockBaseRepository.findById).toHaveBeenCalledWith('message-1');
    });

    it('should return null if message not found', async function (this: void) {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByRoomId', () => {
    it('should find messages by room id', async function (this: void) {
      const mockDbMessages = [
        {
          id: 'message-1',
          room_id: 'room-1',
          sender_id: 'user-1',
          content: 'Test message 1',
          type: 'text' as const,
          metadata: null,
          reply_to_id: null,
          edited_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'message-2',
          room_id: 'room-1',
          sender_id: 'user-2',
          content: 'Test message 2',
          type: 'text' as const,
          metadata: null,
          reply_to_id: null,
          edited_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.execute.mockResolvedValue(mockDbMessages);

      const result = await repository.findByRoomId('room-1');

      expect(mockDb.selectFrom).toHaveBeenCalledWith('chat_messages');
      expect(mockDb.where).toHaveBeenCalledWith('room_id', '=', 'room-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'message-1',
        roomId: 'room-1',
        senderId: 'user-1',
        content: 'Test message 1',
        type: 'text',
        metadata: undefined,
        replyToId: undefined,
        editedAt: undefined,
        createdAt: mockDbMessages[0].created_at,
        updatedAt: mockDbMessages[0].updated_at,
      });
      expect(result[1]).toEqual({
        id: 'message-2',
        roomId: 'room-1',
        senderId: 'user-2',
        content: 'Test message 2',
        type: 'text',
        metadata: undefined,
        replyToId: undefined,
        editedAt: undefined,
        createdAt: mockDbMessages[1].created_at,
        updatedAt: mockDbMessages[1].updated_at,
      });
    });
  });

  describe('create', () => {
    it('should create a new message', async function (this: void) {
      const messageData = {
        roomId: 'room-1',
        senderId: 'user-1',
        content: 'New message',
        type: 'text' as const,
        updatedAt: new Date(),
      };

      const mockCreatedMessage = {
        id: 'message-1',
        room_id: 'room-1',
        sender_id: 'user-1',
        content: 'New message',
        type: 'text' as const,
        metadata: null,
        reply_to_id: null,
        edited_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockBaseRepository.create.mockResolvedValue(mockCreatedMessage);

      const result = await repository.create(messageData);

      expect(result).toBeDefined();
      expect(result.id).toBe('message-1');
      expect(result.content).toBe('New message');
      expect(result.type).toBe('text');
      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        room_id: 'room-1',
        sender_id: 'user-1',
        content: 'New message',
        type: 'text',
        metadata: null,
        reply_to_id: null,
        edited_at: null,
      });
    });
  });

  describe('save', () => {
    it('should save an existing message', async function (this: void) {
      const message: Message = {
        id: 'message-1',
        roomId: 'room-1',
        senderId: 'user-1',
        content: 'Updated message',
        type: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdatedMessage = {
        id: 'message-1',
        room_id: 'room-1',
        sender_id: 'user-1',
        content: 'Updated message',
        type: 'text' as const,
        metadata: null,
        reply_to_id: null,
        edited_at: null,
        created_at: message.createdAt,
        updated_at: new Date(),
      };

      mockBaseRepository.update.mockResolvedValue(mockUpdatedMessage);

      const result = await repository.save(message);

      expect(result).toBeDefined();
      expect(result.content).toBe('Updated message');
    });
  });

  describe('deleteById', () => {
    it('should delete a message', async function (this: void) {
      await repository.deleteById('message-1');

      expect(mockBaseRepository.delete).toHaveBeenCalledWith('message-1');
    });
  });
});
