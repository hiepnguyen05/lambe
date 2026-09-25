import { Module } from '@nestjs/common';
import { PostgresModule } from '../persistence/postgres/postgres.module';
import { AuditService } from './audit.service';

@Module({
  imports: [PostgresModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
