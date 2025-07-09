import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { createMock } from '@golevelup/ts-jest';
import {
  MESSAGE_REPOSITORY_TOKEN,
  ROOM_REPOSITORY_TOKEN,
  NOTIFICATION_REPOSITORY_TOKEN,
} from '../../constants';
import { MessageRepositoryInterface } from '../../domain/repositories/message.repository.interface';
import { RoomRepositoryInterface } from '../../domain/repositories/room.repository.interface';
import { NotificationRepositoryInterface } from '../../domain/repositories/notification.repository.interface';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockSocket: jest.Mocked<Socket>;
  let mockServer: any;
  let mockMessageRepository: jest.Mocked<MessageRepositoryInterface>;
  let mockRoomRepository: jest.Mocked<RoomRepositoryInterface>;
  let mockNotificationRepository: jest.Mocked<NotificationRepositoryInterface>;

  beforeEach(async () => {
    mockMessageRepository = createMock<MessageRepositoryInterface>();
    mockRoomRepository = createMock<RoomRepositoryInterface>();
    mockNotificationRepository = createMock<NotificationRepositoryInterface>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: MESSAGE_REPOSITORY_TOKEN,
          useValue: mockMessageRepository,
        },
        {
          provide: ROOM_REPOSITORY_TOKEN,
          useValue: mockRoomRepository,
        },
        {
          provide: NOTIFICATION_REPOSITORY_TOKEN,
          useValue: mockNotificationRepository,
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);

    mockSocket = createMock<Socket>({
      id: 'test-socket-id',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    });

    mockServer = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
      emit: jest.fn(),
    };

    gateway.server = mockServer;

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      gateway.handleConnection(mockSocket);

      expect(logSpy).toHaveBeenCalledWith('Client connected: test-socket-id');
    });
  });

  describe('handleDisconnect', () => {
    it('should handle disconnection without stored user', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      gateway.handleDisconnect(mockSocket);

      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('User disconnected'),
      );
    });

    it('should handle disconnection with stored user', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      gateway.handleJoinRoom(
        {
          roomId: 'test-room',
          userId: 'test-user',
        },
        mockSocket,
      );

      gateway.handleDisconnect(mockSocket);

      expect(logSpy).toHaveBeenCalledWith(
        'User disconnected: test-user (test-socket-id)',
      );
    });
  });

  describe('handleJoinRoom', () => {
    it('should handle room join', function (this: void) {
      const payload = {
        roomId: 'test-room',
        userId: 'test-user',
      };

      gateway.handleJoinRoom(payload, mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('test-room');
      expect(mockSocket.emit).toHaveBeenCalledWith('roomJoined', {
        roomId: 'test-room',
        userId: 'test-user',
        timestamp: expect.any(String),
      });
      expect(mockSocket.to).toHaveBeenCalledWith('test-room');
    });
  });

  describe('handleLeaveRoom', () => {
    it('should handle room leave', function (this: void) {
      const payload = {
        roomId: 'test-room',
        userId: 'test-user',
      };

      gateway.handleLeaveRoom(payload, mockSocket);

      expect(mockSocket.leave).toHaveBeenCalledWith('test-room');
      expect(mockSocket.emit).toHaveBeenCalledWith('roomLeft', {
        roomId: 'test-room',
        userId: 'test-user',
        timestamp: expect.any(String),
      });
      expect(mockSocket.to).toHaveBeenCalledWith('test-room');
    });
  });

  describe('handleSendMessage', () => {
    it('should handle sending message', async () => {
      const payload = {
        roomId: 'test-room',
        userId: 'test-user',
        message: 'Hello, world!',
        type: 'text' as const,
      };

      const mockMessage = {
        id: 'msg_123',
        roomId: 'test-room',
        senderId: 'test-user',
        content: 'Hello, world!',
        type: 'text' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMessageRepository.create.mockResolvedValue(mockMessage);

      await gateway.handleSendMessage(payload);

      expect(mockMessageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'test-room',
          senderId: 'test-user',
          content: 'Hello, world!',
          type: 'text',
        }),
      );
      expect(mockServer.to).toHaveBeenCalledWith('test-room');
      expect(mockServer.to().emit).toHaveBeenCalledWith('messageReceived', {
        id: mockMessage.id,
        roomId: 'test-room',
        userId: 'test-user',
        message: 'Hello, world!',
        type: 'text',
        timestamp: mockMessage.createdAt.toISOString(),
      });
    });
  });

  describe('handleSendPrivateMessage', () => {
    it('should handle sending private message', async () => {
      const payload = {
        senderId: 'sender-user',
        receiverId: 'receiver-user',
        message: 'Private message',
      };

      const mockMessage = {
        id: 'msg_456',
        roomId: 'receiver-user_sender-user',
        senderId: 'sender-user',
        content: 'Private message',
        type: 'text' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMessageRepository.create.mockResolvedValue(mockMessage);

      await gateway.handleSendPrivateMessage(payload);

      expect(mockMessageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'receiver-user_sender-user',
          senderId: 'sender-user',
          content: 'Private message',
          type: 'text',
        }),
      );
      expect(mockServer.emit).toHaveBeenCalledWith('privateMessageReceived', {
        id: mockMessage.id,
        senderId: 'sender-user',
        receiverId: 'receiver-user',
        message: 'Private message',
        timestamp: mockMessage.createdAt.toISOString(),
      });
    });
  });

  describe('handleSendNotification', () => {
    it('should handle sending notification', async () => {
      const payload = {
        userId: 'test-user',
        notification: {
          title: 'Test Notification',
          message: 'Test message',
          type: 'system' as const,
        },
      };

      const mockNotification = {
        id: 'notif_789',
        userId: 'test-user',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system' as const,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepository.create.mockResolvedValue(mockNotification);

      await gateway.handleSendNotification(payload);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          title: 'Test Notification',
          message: 'Test message',
          type: 'system',
          isRead: false,
        }),
      );
      expect(mockServer.emit).toHaveBeenCalledWith('notificationReceived', {
        id: mockNotification.id,
        userId: 'test-user',
        notification: {
          title: 'Test Notification',
          message: 'Test message',
          type: 'system',
        },
        timestamp: mockNotification.createdAt.toISOString(),
      });
    });
  });

  describe('sendNotificationToUser', () => {
    it('should send notification to specific user when user is connected', function (this: void) {
      const connectedUsers = new Map();
      connectedUsers.set('socket-id-1', 'test-user');
      gateway['connectedUsers'] = connectedUsers;

      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      mockServer.to = mockTo;

      const notification = {
        title: 'Test Notification',
        message: 'Test message',
        type: 'system' as const,
      };

      gateway.sendNotificationToUser('test-user', notification);

      expect(mockServer.to).toHaveBeenCalledWith('socket-id-1');
      expect(mockEmit).toHaveBeenCalledWith('notificationReceived', {
        userId: 'test-user',
        notification: {
          title: 'Test Notification',
          message: 'Test message',
          type: 'system',
        },
        timestamp: expect.any(String),
      });
    });

    it('should not send notification when user is not connected', function (this: void) {
      const connectedUsers = new Map();
      gateway['connectedUsers'] = connectedUsers;

      const notification = {
        title: 'Test Notification',
        message: 'Test message',
        type: 'system' as const,
      };

      gateway.sendNotificationToUser('test-user', notification);

      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });
});
