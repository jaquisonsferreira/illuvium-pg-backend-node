import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable, Inject } from '@nestjs/common';
import { Message } from '../../domain/entities/message.entity';
import { Notification } from '../../domain/entities/notification.entity';
import { MessageRepositoryInterface } from '../../domain/repositories/message.repository.interface';
import { RoomRepositoryInterface } from '../../domain/repositories/room.repository.interface';
import { NotificationRepositoryInterface } from '../../domain/repositories/notification.repository.interface';
import {
  MESSAGE_REPOSITORY_TOKEN,
  ROOM_REPOSITORY_TOKEN,
  NOTIFICATION_REPOSITORY_TOKEN,
} from '../../constants';

interface JoinRoomPayload {
  roomId: string;
  userId: string;
}

interface LeaveRoomPayload {
  roomId: string;
  userId: string;
}

interface SendMessagePayload {
  roomId: string;
  userId: string;
  message: string;
  type: Message['type'];
}

interface SendPrivateMessagePayload {
  senderId: string;
  receiverId: string;
  message: string;
}

interface SendNotificationPayload {
  userId: string;
  notification: {
    title: string;
    message: string;
    type: Notification['type'];
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, string>();

  constructor(
    @Inject(MESSAGE_REPOSITORY_TOKEN)
    private readonly messageRepository: MessageRepositoryInterface,
    @Inject(ROOM_REPOSITORY_TOKEN)
    private readonly roomRepository: RoomRepositoryInterface,
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: NotificationRepositoryInterface,
  ) {}

  afterInit() {
    this.logger.log('Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    if (userId) {
      this.connectedUsers.delete(client.id);
      this.logger.log(`User disconnected: ${userId} (${client.id})`);
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() payload: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, userId } = payload;

    void client.join(roomId);
    this.connectedUsers.set(client.id, userId);

    this.logger.log(`User ${userId} joined room ${roomId}`);

    client.emit('roomJoined', {
      roomId,
      userId,
      timestamp: new Date().toISOString(),
    });

    client.to(roomId).emit('userJoinedRoom', {
      roomId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() payload: LeaveRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, userId } = payload;

    void client.leave(roomId);

    this.logger.log(`User ${userId} left room ${roomId}`);

    client.emit('roomLeft', {
      roomId,
      userId,
      timestamp: new Date().toISOString(),
    });

    client.to(roomId).emit('userLeftRoom', {
      roomId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(@MessageBody() payload: SendMessagePayload) {
    const { roomId, userId, message, type } = payload;
    const timestamp = new Date();

    this.logger.log(`Message from ${userId} in room ${roomId}: ${message}`);

    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      senderId: userId,
      content: message,
      type,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      const savedMessage = await this.messageRepository.create(newMessage);

      const messageData = {
        id: savedMessage.id,
        roomId: savedMessage.roomId,
        userId: savedMessage.senderId,
        message: savedMessage.content,
        type: savedMessage.type,
        timestamp: savedMessage.createdAt.toISOString(),
      };

      this.server.to(roomId).emit('messageReceived', messageData);
    } catch (error) {
      this.logger.error(`Failed to save message: ${error}`);

      const messageData = {
        id: newMessage.id,
        roomId,
        userId,
        message,
        type,
        timestamp: timestamp.toISOString(),
      };
      this.server.to(roomId).emit('messageReceived', messageData);
    }
  }

  @SubscribeMessage('sendPrivateMessage')
  async handleSendPrivateMessage(
    @MessageBody() payload: SendPrivateMessagePayload,
  ) {
    const { senderId, receiverId, message } = payload;
    const timestamp = new Date();

    this.logger.log(`Private message from ${senderId} to ${receiverId}`);

    const roomId = [senderId, receiverId].sort().join('_');

    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      senderId,
      content: message,
      type: 'text',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      const savedMessage = await this.messageRepository.create(newMessage);

      const messageData = {
        id: savedMessage.id,
        senderId: savedMessage.senderId,
        receiverId,
        message: savedMessage.content,
        timestamp: savedMessage.createdAt.toISOString(),
      };

      this.server.emit('privateMessageReceived', messageData);

      const receiverSocketId = this.findSocketByUserId(receiverId);
      if (receiverSocketId) {
        this.server
          .to(receiverSocketId)
          .emit('privateMessageReceived', messageData);
      }
    } catch (error) {
      this.logger.error(`Failed to save private message: ${error}`);

      const messageData = {
        id: newMessage.id,
        senderId,
        receiverId,
        message,
        timestamp: timestamp.toISOString(),
      };

      this.server.emit('privateMessageReceived', messageData);

      const receiverSocketId = this.findSocketByUserId(receiverId);
      if (receiverSocketId) {
        this.server
          .to(receiverSocketId)
          .emit('privateMessageReceived', messageData);
      }
    }
  }

  @SubscribeMessage('sendNotification')
  async handleSendNotification(
    @MessageBody() payload: SendNotificationPayload,
  ) {
    const { userId, notification } = payload;
    const timestamp = new Date();

    this.logger.log(`Notification for ${userId}: ${notification.title}`);

    const newNotification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      const savedNotification =
        await this.notificationRepository.create(newNotification);

      const notificationData = {
        id: savedNotification.id,
        userId: savedNotification.userId,
        notification: {
          title: savedNotification.title,
          message: savedNotification.message,
          type: savedNotification.type,
        },
        timestamp: savedNotification.createdAt.toISOString(),
      };

      this.server.emit('notificationReceived', notificationData);

      const targetSocketId = this.findSocketByUserId(userId);
      if (targetSocketId) {
        this.server
          .to(targetSocketId)
          .emit('notificationReceived', notificationData);
      }
    } catch (error) {
      this.logger.error(`Failed to save notification: ${error}`);
      const notificationData = {
        id: newNotification.id,
        userId,
        notification,
        timestamp: timestamp.toISOString(),
      };

      this.server.emit('notificationReceived', notificationData);

      const targetSocketId = this.findSocketByUserId(userId);
      if (targetSocketId) {
        this.server
          .to(targetSocketId)
          .emit('notificationReceived', notificationData);
      }
    }
  }

  private findSocketByUserId(userId: string): string | undefined {
    for (const [socketId, connectedUserId] of this.connectedUsers.entries()) {
      if (connectedUserId === userId) {
        return socketId;
      }
    }
    return undefined;
  }

  sendNotificationToUser(
    userId: string,
    notification: {
      title: string;
      message: string;
      type: Notification['type'];
    },
  ) {
    const targetSocketId = this.findSocketByUserId(userId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('notificationReceived', {
        userId,
        notification,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Notification sent to ${userId}: ${notification.title}`);
    }
  }
}
