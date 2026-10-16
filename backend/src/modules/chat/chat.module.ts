import { Module } from '@nestjs/common';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { ChatService } from './application/chat.service';
import { ChatQueryService } from './application/chat-query.service';
import { ChatModerationService } from './application/chat-moderation.service';
import { ChatController } from './controllers/chat.controller';

@Module({
  imports: [PostgresModule, AuthModule],
  controllers: [ChatController],
  providers: [ChatService, ChatQueryService, ChatModerationService],
  exports: [ChatService],
})
export class ChatModule {}
