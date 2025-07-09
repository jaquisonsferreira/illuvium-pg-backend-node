import { Test, TestingModule } from '@nestjs/testing';
import { NotificationRepository } from './notification.repository';
import { Notification } from '../../domain/entities/notification.entity';
import {
  RepositoryFactory,
  DATABASE_CONNECTION,
  BaseRepository,
} from '@shared/infrastructure/database';

describe('NotificationRepository', () => {
  let repository: NotificationRepository;
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
      execute: jest.fn(),
      updateTable: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRepository,
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

    repository = module.get<NotificationRepository>(NotificationRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findById', () => {
    it('should return notification when found', async function (this: void) {
      const mockDbNotification = {
        id: 'notification-1',
        user_id: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system' as const,
        is_read: false,
        data: { key: 'value' },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockBaseRepository.findById.mockResolvedValue(mockDbNotification);

      const result = await repository.findById('notification-1');

      expect(mockBaseRepository.findById).toHaveBeenCalledWith(
        'notification-1',
      );
      expect(result).toEqual({
        id: 'notification-1',
        userId: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system',
        isRead: false,
        data: { key: 'value' },
        createdAt: mockDbNotification.created_at,
        updatedAt: mockDbNotification.updated_at,
      });
    });

    it('should return null when not found', async function (this: void) {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('notification-1');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return notifications for user', async function (this: void) {
      const mockDbNotifications = [
        {
          id: 'notification-1',
          user_id: 'user-1',
          title: 'Test Notification',
          message: 'Test message',
          type: 'system' as const,
          is_read: false,
          data: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.execute.mockResolvedValue(mockDbNotifications);

      const result = await repository.findByUserId('user-1');

      expect(mockDb.selectFrom).toHaveBeenCalledWith('chat_notifications');
      expect(mockDb.where).toHaveBeenCalledWith('user_id', '=', 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'notification-1',
        userId: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system',
        isRead: false,
        data: undefined,
        createdAt: mockDbNotifications[0].created_at,
        updatedAt: mockDbNotifications[0].updated_at,
      });
    });

    it('should apply limit when provided', async function (this: void) {
      mockDb.execute.mockResolvedValue([]);

      await repository.findByUserId('user-1', 10);

      expect(mockDb.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('create', () => {
    it('should create notification', async function (this: void) {
      const notificationData = {
        userId: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system' as const,
        isRead: false,
        updatedAt: new Date(),
      };

      const mockCreatedNotification = {
        id: 'notification-1',
        user_id: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system' as const,
        is_read: false,
        data: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockBaseRepository.create.mockResolvedValue(mockCreatedNotification);

      const result = await repository.create(notificationData);

      expect(mockBaseRepository.create).toHaveBeenCalledWith({
        user_id: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system',
        is_read: false,
        data: null,
      });
      expect(result).toEqual({
        id: 'notification-1',
        userId: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system',
        isRead: false,
        data: undefined,
        createdAt: mockCreatedNotification.created_at,
        updatedAt: mockCreatedNotification.updated_at,
      });
    });
  });

  describe('save', () => {
    it('should save notification', async function (this: void) {
      const notification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system',
        isRead: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdatedNotification = {
        id: 'notification-1',
        user_id: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system' as const,
        is_read: true,
        data: null,
        created_at: notification.createdAt,
        updated_at: notification.updatedAt,
      };

      mockBaseRepository.update.mockResolvedValue(mockUpdatedNotification);

      const result = await repository.save(notification);

      expect(mockBaseRepository.update).toHaveBeenCalledWith('notification-1', {
        user_id: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system',
        is_read: true,
        data: null,
      });
      expect(result).toEqual({
        id: 'notification-1',
        userId: 'user-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system',
        isRead: true,
        data: undefined,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      });
    });
  });

  describe('deleteById', () => {
    it('should delete notification', async function (this: void) {
      await repository.deleteById('notification-1');

      expect(mockBaseRepository.delete).toHaveBeenCalledWith('notification-1');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async function (this: void) {
      await repository.markAsRead('notification-1');

      expect(mockBaseRepository.update).toHaveBeenCalledWith('notification-1', {
        is_read: true,
      });
    });
  });

  describe('markAllAsReadForUser', () => {
    it('should mark all notifications as read for user', async function (this: void) {
      await repository.markAllAsReadForUser('user-1');

      expect(mockDb.updateTable).toHaveBeenCalledWith('chat_notifications');
      expect(mockDb.set).toHaveBeenCalledWith({ is_read: true });
      expect(mockDb.where).toHaveBeenCalledWith('user_id', '=', 'user-1');
      expect(mockDb.where).toHaveBeenCalledWith('is_read', '=', false);
      expect(mockDb.execute).toHaveBeenCalled();
    });
  });
});
