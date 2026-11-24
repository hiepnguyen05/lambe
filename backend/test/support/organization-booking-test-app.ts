import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../src/infrastructure/audit/audit.service';
import { RedisCacheService } from '../../src/infrastructure/cache/redis-cache.service';
import { KycCryptoService } from '../../src/infrastructure/kyc/kyc-crypto.service';
import { OsrmRoutingService } from '../../src/modules/orders/application/tracking/osrm-routing.service';
import { createTestApp } from './create-test-app';

export async function createOrganizationBookingTestApp() {
  if (
    process.env.NODE_ENV !== 'test' ||
    !/^\/lambe_booking_test_[a-z0-9_]+$/.test(
      new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/').pathname,
    ) ||
    new URL(process.env.REDIS_URL ?? 'redis://localhost/').pathname !== '/15'
  )
    throw new Error(
      'Organization booking requires NODE_ENV=test, an isolated lambe_booking_test_* database, and Redis database 15.',
    );
  const c = await createTestApp();
  const config = c.app.get(ConfigService);
  const cache = c.app.get(RedisCacheService);
  if (cache.getStatus() !== 'up') {
    await c.app.close();
    throw new Error('Redis test database is unavailable.');
  }
  // Keep one listener for concurrent Supertest requests; per-request auto-close can reset peers.
  await c.app.listen(0, '127.0.0.1');
  jest.spyOn(c.app.get(OsrmRoutingService), 'getRoute').mockResolvedValue(null);
  return {
    ...c,
    jwt: new JwtService({
      secret: config.getOrThrow<string>('security.jwtSecret'),
    }),
    crypto: new KycCryptoService(
      new ConfigService({
        kyc: { encryptionKey: Buffer.alloc(32, 7).toString('base64') },
      }),
    ),
    audit: c.app.get(AuditService),
    media: c.mediaStorage,
    cache,
  };
}
