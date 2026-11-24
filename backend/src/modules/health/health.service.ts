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
  private databaseResult?: { up: boolean; expiresAt: number };
  private databaseProbe?: Promise<boolean>;
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_STORE) private readonly cache: CacheStore,
  ) {}

  private checkDatabase(): Promise<boolean> {
    if (this.databaseResult && this.databaseResult.expiresAt > Date.now()) {
      return Promise.resolve(this.databaseResult.up);
    }
    if (this.databaseProbe) return this.databaseProbe;
    let timer: ReturnType<typeof setTimeout>;
    const query = Promise.resolve()
      .then(() => this.prisma.$queryRaw(Prisma.sql`SELECT 1`))
      .then(
        () => true,
        () => false,
      )
      .then((up) => {
        clearTimeout(timer);
        this.databaseResult = { up, expiresAt: Date.now() + 1_000 };
        this.databaseProbe = undefined;
        return up;
      });
    const deadline = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), 1_000);
    });
    // A timed-out query is not cancelled: retain its shared result until it settles.
    // New health requests must never launch more pings while that query is running.
    this.databaseProbe = Promise.race([query, deadline]);
    return this.databaseProbe;
  }

  async check() {
    const databaseUp = await this.checkDatabase();
    const cache = this.cache.getStatus();
    if (!databaseUp) {
      throw new ServiceUnavailableException({
        success: false,
        status: 'unavailable',
        services: { database: 'down', cache },
      });
    }

    return {
      status: cache === 'down' ? 'degraded' : 'ok',
      services: { database: 'up', cache },
    };
  }
}
