import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailOutboxService } from './mail-outbox.service';
import { PostgresModule } from '../persistence/postgres/postgres.module';

@Module({
  imports: [PostgresModule],
  providers: [MailService, MailOutboxService],
  exports: [MailService, MailOutboxService],
})
export class MailModule {}
