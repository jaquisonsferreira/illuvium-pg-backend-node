import { Room, RoomParticipant } from '../entities/room.entity';

export interface RoomRepositoryInterface {
  findById(id: string): Promise<Room | null>;
  findByUserId(userId: string): Promise<Room[]>;
  save(room: Room): Promise<Room>;
  create(roomData: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>): Promise<Room>;
  deleteById(id: string): Promise<void>;
  addParticipant(roomId: string, participant: RoomParticipant): Promise<void>;
  removeParticipant(roomId: string, userId: string): Promise<void>;
  getParticipants(roomId: string): Promise<RoomParticipant[]>;
}
