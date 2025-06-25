export interface Room {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'guild';
  description?: string | null;
  ownerId: string;
  isPrivate: boolean;
  maxParticipants?: number | null;
  participantIds: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface RoomParticipant {
  roomId: string;
  userId: string;
  joinedAt: Date;
  role?: 'admin' | 'moderator' | 'member';
}
