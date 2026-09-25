import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CACHE_STORE,
  type CacheStore,
} from '../../infrastructure/cache/cache-store';
import { PrismaService } from '../../infrastructure/persistence/postgres/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_STORE) private readonly cache: CacheStore,
  ) {}

  async check() {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
    } catch {
      throw new ServiceUnavailableException({
        success: false,
        status: 'unavailable',
        services: { database: 'down', cache: this.cache.getStatus() },
      });
    }

    const cache = this.cache.getStatus();
    return {
      status: cache === 'down' ? 'degraded' : 'ok',
      services: { database: 'up', cache },
    };
  }
}
