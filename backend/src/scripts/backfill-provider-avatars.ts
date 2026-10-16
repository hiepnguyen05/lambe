import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AdminProviderManagementService } from '../modules/providers/application/management/admin-provider-management.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const service = app.get(AdminProviderManagementService);
    const result = await service.backfillMissingAvatars();
    Logger.log(JSON.stringify(result), 'ProviderAvatarBackfill');
    if (result.failed.length > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.message : 'Unknown backfill error',
    undefined,
    'ProviderAvatarBackfill',
  );
  process.exitCode = 1;
});
