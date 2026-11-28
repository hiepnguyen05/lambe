import { Module } from '@nestjs/common';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { GuidanceController } from './guidance.controller';
import { GuidanceService } from './guidance.service';

@Module({
  imports: [PostgresModule, AuthModule],
  controllers: [GuidanceController],
  providers: [GuidanceService],
})
export class GuidanceModule {}
