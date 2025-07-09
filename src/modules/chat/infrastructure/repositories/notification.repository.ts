import { Injectable, Inject } from '@nestjs/common';
import { Notification } from '../../domain/entities/notification.entity';
import { NotificationRepositoryInterface } from '../../domain/repositories/notification.repository.interface';
import {
  RepositoryFactory,
  DATABASE_CONNECTION,
  BaseRepository,
} from '@shared/infrastructure/database';
import {
  ChatNotification,
  NewChatNotification,
  ChatNotificationUpdate,
} from '@shared/infrastructure/database/database.types';

@Injectable()
export class NotificationRepository implements NotificationRepositoryInterface {
  private repository: BaseRepository<
    'chat_notifications',
    ChatNotification,
    NewChatNotification,
    ChatNotificationUpdate
  >;

  constructor(
    private repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION) private db: any,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'chat_notifications',
      ChatNotification,
      NewChatNotification,
      ChatNotificationUpdate
    >('chat_notifications');
  }

  async findById(id: string): Promise<Notification | null> {
    const dbNotification = await this.repository.findById(id);
    return dbNotification ? this.toDomainEntity(dbNotification) : null;
  }

  async findByUserId(userId: string, limit?: number): Promise<Notification[]> {
    let query = this.db
      .selectFrom('chat_notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc');

    if (limit) {
      query = query.limit(limit);
    }

    const dbNotifications = await query.execute();

    return dbNotifications.map((dbNotification: any) =>
      this.toDomainEntity(dbNotification),
    );
  }

  async create(
    notificationData: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Notification> {
    const dbNotification = await this.repository.create(
      this.toDbEntity(notificationData),
    );
    return this.toDomainEntity(dbNotification);
  }

  async save(notification: Notification): Promise<Notification> {
    const notificationData = this.toDbEntity(notification);
    const saved = await this.repository.update(
      notification.id,
      notificationData,
    );
    if (!saved) {
      throw new Error(`Failed to save notification with id ${notification.id}`);
    }
    return this.toDomainEntity(saved);
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async markAsRead(id: string): Promise<void> {
    await this.repository.update(id, { is_read: true });
  }

  async markAllAsReadForUser(userId: string): Promise<void> {
    await this.db
      .updateTable('chat_notifications')
      .set({ is_read: true })
      .where('user_id', '=', userId)
      .where('is_read', '=', false)
      .execute();
  }

  private toDbEntity(
    notificationData: Partial<Notification>,
  ): NewChatNotification {
    return {
      user_id: notificationData.userId!,
      type: notificationData.type!,
      title: notificationData.title!,
      message: notificationData.message!,
      is_read: notificationData.isRead || false,
      data: notificationData.data || null,
    };
  }

  private toDomainEntity(dbNotification: ChatNotification): Notification {
    return {
      id: dbNotification.id,
      userId: dbNotification.user_id,
      type: dbNotification.type,
      title: dbNotification.title,
      message: dbNotification.message,
      isRead: dbNotification.is_read,
      data: dbNotification.data || undefined,
      createdAt: dbNotification.created_at,
      updatedAt: dbNotification.updated_at,
    };
  }
}
