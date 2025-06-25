import { Injectable, Inject } from '@nestjs/common';
import { Message } from '../../domain/entities/message.entity';
import { MessageRepositoryInterface } from '../../domain/repositories/message.repository.interface';
import {
  RepositoryFactory,
  DATABASE_CONNECTION,
  BaseRepository,
} from '@shared/infrastructure/database';
import {
  ChatMessage,
  NewChatMessage,
  ChatMessageUpdate,
} from '@shared/infrastructure/database/database.types';

@Injectable()
export class MessageRepository implements MessageRepositoryInterface {
  private repository: BaseRepository<
    'chat_messages',
    ChatMessage,
    NewChatMessage,
    ChatMessageUpdate
  >;

  constructor(
    private repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION) private db: any,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'chat_messages',
      ChatMessage,
      NewChatMessage,
      ChatMessageUpdate
    >('chat_messages');
  }

  async findById(id: string): Promise<Message | null> {
    const dbMessage = await this.repository.findById(id);
    return dbMessage ? this.toDomainEntity(dbMessage) : null;
  }

  async findByRoomId(roomId: string): Promise<Message[]> {
    const dbMessages = await this.db
      .selectFrom('chat_messages')
      .selectAll()
      .where('room_id', '=', roomId)
      .orderBy('created_at', 'asc')
      .execute();

    return dbMessages.map((dbMessage: any) => this.toDomainEntity(dbMessage));
  }

  async create(
    messageData: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Message> {
    const dbMessage = await this.repository.create(
      this.toDbEntity(messageData),
    );
    return this.toDomainEntity(dbMessage);
  }

  async save(message: Message): Promise<Message> {
    const messageData = this.toDbEntity(message);
    const saved = await this.repository.update(message.id, messageData);
    if (!saved) {
      throw new Error(`Failed to save message with id ${message.id}`);
    }
    return this.toDomainEntity(saved);
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toDbEntity(messageData: Partial<Message>): NewChatMessage {
    return {
      room_id: messageData.roomId!,
      sender_id: messageData.senderId!,
      content: messageData.content!,
      type: messageData.type!,
      metadata: messageData.metadata || null,
      reply_to_id: messageData.replyToId || null,
      edited_at: messageData.editedAt || null,
    };
  }

  private toDomainEntity(dbMessage: ChatMessage): Message {
    return {
      id: dbMessage.id,
      roomId: dbMessage.room_id,
      senderId: dbMessage.sender_id,
      content: dbMessage.content,
      type: dbMessage.type,
      replyToId: dbMessage.reply_to_id || undefined,
      editedAt: dbMessage.edited_at || undefined,
      createdAt: dbMessage.created_at,
      updatedAt: dbMessage.updated_at,
      metadata: dbMessage.metadata || undefined,
    };
  }
}
