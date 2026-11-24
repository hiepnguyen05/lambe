import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(
    options: Prisma.PrismaClientOptions = {},
    observeQuery?: (durationMs: number) => void,
  ) {
    super({
      ...options,
      ...(observeQuery && {
        log: [...(options.log ?? []), { emit: 'event', level: 'query' }],
      }),
      transactionOptions: {
        maxWait: 10000,
        timeout: 15000,
        ...options.transactionOptions,
      },
    });
    if (observeQuery) {
      this.$on('query', ({ duration }) => observeQuery(duration));
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();

      this.logger.log({ event: 'postgres.connected' });
    } catch (error: unknown) {
      this.logger.error({ event: 'postgres.connection_failed' });
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
