import { Module } from '@nestjs/common';
import { PostgresModule } from '../persistence/postgres/postgres.module';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [PostgresModule],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
