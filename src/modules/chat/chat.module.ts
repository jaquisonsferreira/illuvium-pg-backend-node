import { Module } from '@nestjs/common';
import { ChatGateway } from './interface/gateways/chat.gateway';
import { MessageRepository } from './infrastructure/repositories/message.repository';
import { RoomRepository } from './infrastructure/repositories/room.repository';
import { NotificationRepository } from './infrastructure/repositories/notification.repository';
import {
  MESSAGE_REPOSITORY_TOKEN,
  ROOM_REPOSITORY_TOKEN,
  NOTIFICATION_REPOSITORY_TOKEN,
} from './constants';

@Module({
  providers: [
    ChatGateway,
    {
      provide: MESSAGE_REPOSITORY_TOKEN,
      useClass: MessageRepository,
    },
    {
      provide: ROOM_REPOSITORY_TOKEN,
      useClass: RoomRepository,
    },
    {
      provide: NOTIFICATION_REPOSITORY_TOKEN,
      useClass: NotificationRepository,
    },
  ],
  exports: [ChatGateway],
})
export class ChatModule {}
