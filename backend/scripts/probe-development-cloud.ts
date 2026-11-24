import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

// Read-only probe for the existing development Neon/Upstash configuration.
// This file must not import the Nest app or invoke migrations/fixtures.
export function developmentTargets(contents: string) {
  const values = parse(contents);
  const pooled = new URL(values.DATABASE_URL ?? '');
  const direct = new URL(values.DIRECT_URL ?? '');
  const redis = new URL(values.REDIS_URL ?? '');
  if (
    !['postgres:', 'postgresql:'].includes(pooled.protocol) ||
    !pooled.hostname.endsWith('.neon.tech') ||
    !pooled.hostname.includes('-pooler.') ||
    !pooled.username ||
    !pooled.password ||
    !['postgres:', 'postgresql:'].includes(direct.protocol) ||
    direct.hostname !== pooled.hostname.replace('-pooler.', '.') ||
    direct.pathname !== pooled.pathname ||
    direct.username !== pooled.username ||
    direct.password !== pooled.password ||
    pooled.searchParams.get('sslmode') !== 'require' ||
    direct.searchParams.get('sslmode') !== 'require' ||
    redis.protocol !== 'rediss:' ||
    !redis.hostname.endsWith('.upstash.io') ||
    !redis.username ||
    !redis.password
  )
    throw new Error('Invalid development Neon/Upstash targets.');
  return { databaseUrl: values.DATABASE_URL, redisUrl: values.REDIS_URL };
}

export async function probeDevelopmentCloud(contents: string) {
  const targets = developmentTargets(contents);
  const prisma = new PrismaClient({
    datasources: { db: { url: targets.databaseUrl } },
  });
  const redis = createClient({
    url: targets.redisUrl,
    disableOfflineQueue: true,
    socket: { reconnectStrategy: false, connectTimeout: 4000 },
  });
  redis.on('error', () => undefined);
  const result: {
    postgres: Record<string, unknown>;
    redis: Record<string, unknown>;
  } = { postgres: { status: 'unavailable' }, redis: { status: 'unavailable' } };
  try {
    const rows = await prisma.$queryRaw<
      { database: string; version: string }[]
    >`SELECT current_database() AS database, current_setting('server_version') AS version`;
    result.postgres = {
      status: 'up',
      database: rows[0].database,
      version: rows[0].version,
    };
    try {
      const settings = await prisma.$queryRaw<
        { max_connections: number }[]
      >`SELECT current_setting('max_connections')::int AS max_connections`;
      result.postgres.maxConnections = settings[0].max_connections;
    } catch {
      result.postgres.maxConnections = 'unavailable';
    }
    try {
      const stats = await prisma.$queryRaw<
        { state: string | null; connections: bigint }[]
      >`SELECT state, COUNT(*) AS connections FROM pg_stat_activity WHERE datname = current_database() GROUP BY state`;
      result.postgres.connections = stats.map(({ state, connections }) => ({
        state: state ?? 'other',
        count: Number(connections),
      }));
    } catch {
      result.postgres.connections = 'unavailable';
    }
  } catch {
    result.postgres = { status: 'unavailable' };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
  try {
    await redis.connect();
    const pong = await redis.ping();
    result.redis = {
      status: pong === 'PONG' ? 'up' : 'unavailable',
      keys: await redis.dbSize(),
    };
  } catch {
    result.redis = { status: 'unavailable' };
  } finally {
    if (redis.isOpen) redis.destroy();
  }
  return result;
}

if (require.main === module) {
  void (async () => {
    try {
      const contents = readFileSync(resolve(__dirname, '..', '.env'), 'utf8');
      const result = await probeDevelopmentCloud(contents);
      process.stdout.write(JSON.stringify(result) + '\n');
      if (result.postgres.status !== 'up' || result.redis.status !== 'up')
        process.exitCode = 1;
    } catch {
      process.stdout.write('{"status":"refused_or_unavailable"}\n');
      process.exitCode = 1;
    }
  })();
}
