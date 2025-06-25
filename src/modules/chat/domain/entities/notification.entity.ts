export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'system' | 'chat' | 'mention';
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
  readAt?: Date;
  data?: Record<string, any>;
}
