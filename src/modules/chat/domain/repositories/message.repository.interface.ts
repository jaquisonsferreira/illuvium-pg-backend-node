import { Message } from '../entities/message.entity';

export interface MessageRepositoryInterface {
  findByRoomId(roomId: string, limit?: number): Promise<Message[]>;
  findById(id: string): Promise<Message | null>;
  save(message: Message): Promise<Message>;
  create(
    messageData: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Message>;
  deleteById(id: string): Promise<void>;
}
