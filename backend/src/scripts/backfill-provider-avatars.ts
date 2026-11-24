import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AdminProviderManagementService } from '../modules/providers/application/management/admin-provider-management.service';

function parseOptions(args: string[]): { cursor?: string; limit?: number } {
  const options: { cursor?: string; limit?: number } = {};
  for (const arg of args) {
    if (arg.startsWith('--cursor=')) {
      options.cursor = arg.slice('--cursor='.length);
      if (!options.cursor) throw new Error('--cursor must be a provider ID');
    } else if (arg.startsWith('--limit=')) {
      const value = arg.slice('--limit='.length);
      options.limit = Number(value);
      if (!/^\d+$/.test(value) || options.limit < 1 || options.limit > 500) {
        throw new Error('--limit must be an integer between 1 and 500');
      }
    } else {
      throw new Error(`Unknown backfill option: ${arg.split('=')[0]}`);
    }
  }
  return options;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const service = app.get(AdminProviderManagementService);
    const result = await service.backfillMissingAvatars(options);
    Logger.log(JSON.stringify(result), 'ProviderAvatarBackfill');
    if (result.failed > 0) process.exitCode = 1;
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
