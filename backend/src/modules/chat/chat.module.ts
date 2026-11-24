import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { OrderChatService } from './application/order-chat.service';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
import { PushModule } from '../push/push.module';
import { ChatImageService } from './application/chat-image.service';
import { ChatService } from './application/chat.service';
import { ChatQueryService } from './application/chat-query.service';
import { ChatModerationService } from './application/chat-moderation.service';
import { ChatController } from './controllers/chat.controller';
import { ChatEventsController } from './controllers/chat-events.controller';

@Module({
  imports: [
    PostgresModule,
    CacheModule,
    AuthModule,
    UploadModule,
    PushModule,
    AuditModule,
  ],
  controllers: [ChatController, ChatEventsController],
  providers: [
    OrderChatService,
    ChatService,
    ChatImageService,
    ChatQueryService,
    ChatModerationService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
