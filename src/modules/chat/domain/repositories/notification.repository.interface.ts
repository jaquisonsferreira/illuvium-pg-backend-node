import { Notification } from '../entities/notification.entity';

export interface NotificationRepositoryInterface {
  findByUserId(userId: string, limit?: number): Promise<Notification[]>;
  findById(id: string): Promise<Notification | null>;
  save(notification: Notification): Promise<Notification>;
  create(
    notificationData: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Notification>;
  deleteById(id: string): Promise<void>;
  markAsRead(id: string): Promise<void>;
  markAllAsReadForUser(userId: string): Promise<void>;
}
