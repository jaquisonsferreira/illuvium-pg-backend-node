import { Inject, Injectable } from '@nestjs/common';
import { RoomRepositoryInterface } from '../../domain/repositories/room.repository.interface';
import { Room, RoomParticipant } from '../../domain/entities/room.entity';
import {
  ChatRoom as DbChatRoom,
  Database,
  NewChatRoom,
  ChatRoomUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';
import { sql } from 'kysely';

@Injectable()
export class RoomRepository implements RoomRepositoryInterface {
  private repository: BaseRepository<
    'chat_rooms',
    DbChatRoom,
    NewChatRoom,
    ChatRoomUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'chat_rooms',
      DbChatRoom,
      NewChatRoom,
      ChatRoomUpdate
    >('chat_rooms');
  }

  async findById(id: string): Promise<Room | null> {
    const dbRoom = await this.repository.findById(id);
    return dbRoom ? this.toDomainEntity(dbRoom) : null;
  }

  async findByUserId(userId: string): Promise<Room[]> {
    const dbRooms = await this.db
      .selectFrom('chat_rooms')
      .selectAll()
      .where('owner_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();

    return dbRooms.map((row) => this.toDomainEntity(row));
  }

  async save(room: Room): Promise<Room> {
    const roomData = this.toDbEntity(room);
    const saved = await this.repository.update(room.id, roomData);
    if (!saved) {
      throw new Error(`Failed to save room with id ${room.id}`);
    }
    return this.toDomainEntity(saved);
  }

  async create(
    roomData: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Room> {
    const dbRoomData: NewChatRoom = {
      name: roomData.name,
      type: roomData.type,
      description: roomData.description || null,
      owner_id: roomData.ownerId,
      is_private: roomData.isPrivate,
      max_participants: roomData.maxParticipants || null,
    };

    const created = await this.repository.create(dbRoomData);
    return this.toDomainEntity(created);
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async addParticipant(
    roomId: string,
    participant: RoomParticipant,
  ): Promise<void> {
    await sql`
      INSERT INTO chat_room_participants (room_id, user_id, role, joined_at)
      VALUES (${roomId}, ${participant.userId}, ${participant.role}, ${new Date()})
      ON CONFLICT (room_id, user_id) DO NOTHING
    `.execute(this.db);
  }

  async removeParticipant(roomId: string, userId: string): Promise<void> {
    await sql`
      DELETE FROM chat_room_participants
      WHERE room_id = ${roomId} AND user_id = ${userId}
    `.execute(this.db);
  }

  async getParticipants(roomId: string): Promise<RoomParticipant[]> {
    const result = await sql`
      SELECT user_id, role, joined_at FROM chat_room_participants
      WHERE room_id = ${roomId}
      ORDER BY joined_at ASC
    `.execute(this.db);

    return result.rows.map((row: any) => ({
      roomId,
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
    }));
  }

  private toDomainEntity(dbRoom: DbChatRoom): Room {
    return {
      id: dbRoom.id,
      name: dbRoom.name,
      type: dbRoom.type,
      description: dbRoom.description,
      ownerId: dbRoom.owner_id,
      isPrivate: dbRoom.is_private,
      maxParticipants: dbRoom.max_participants,
      participantIds: [],
      createdAt: dbRoom.created_at,
      updatedAt: dbRoom.updated_at,
    };
  }

  private toDbEntity(room: Room): ChatRoomUpdate {
    return {
      name: room.name,
      type: room.type,
      description: room.description || null,
      owner_id: room.ownerId,
      is_private: room.isPrivate,
      max_participants: room.maxParticipants || null,
    };
  }
}
