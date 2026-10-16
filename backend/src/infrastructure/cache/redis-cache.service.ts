import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';
import type { CacheStatus, CacheStore } from './cache-store';
import type {
  ProviderLocationPoint,
  ProviderLocationStore,
} from '../location/provider-location.store';

const PROVIDER_GEO_KEY = 'lambe:providers:online:geo';
const PROVIDER_HEARTBEAT_KEY = 'lambe:providers:online:heartbeat';

export interface RateLimitRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisCacheService
  implements CacheStore, ProviderLocationStore, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisCacheService.name);
  private client?: RedisClientType;
  private readonly enabled: boolean;
  private readonly defaultTtlSeconds: number;
  private readonly providerLocationTtlSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('cache.enabled', false);
    this.defaultTtlSeconds = this.configService.get<number>(
      'cache.defaultTtlSeconds',
      300,
    );
    this.providerLocationTtlSeconds = this.configService.get<number>(
      'cache.providerLocationTtlSeconds',
      120,
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log(
        'Redis cache is disabled; PostgreSQL will be used directly.',
      );
      return;
    }

    this.client = createClient({
      url: this.configService.getOrThrow<string>('cache.url'),
      socket: {
        connectTimeout: this.configService.get<number>(
          'cache.connectTimeoutMs',
          3000,
        ),
        reconnectStrategy: false,
      },
    });
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis cache error: ${error.message}`);
    });

    try {
      await this.client.connect();
      this.logger.log('Redis cache connected successfully.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Redis cache unavailable (${message}); continuing without cache.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.close();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client?.isReady) return null;

    try {
      const value = await this.client.get(key);
      return value === null ? null : (JSON.parse(value) as T);
    } catch (error: unknown) {
      this.logOperationFailure('read', key, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client?.isReady) return;

    try {
      await this.client.set(key, JSON.stringify(value), {
        expiration: {
          type: 'EX',
          value: ttlSeconds ?? this.defaultTtlSeconds,
        },
      });
    } catch (error: unknown) {
      this.logOperationFailure('write', key, error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client?.isReady) return;

    try {
      await this.client.del(key);
    } catch (error: unknown) {
      this.logOperationFailure('delete', key, error);
    }
  }

  getStatus(): CacheStatus {
    if (!this.enabled) return 'disabled';
    return this.client?.isReady ? 'up' : 'down';
  }

  async upsert(
    providerId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const client = this.requireRealtimeClient();
    await client
      .multi()
      .geoAdd(PROVIDER_GEO_KEY, {
        member: providerId,
        latitude,
        longitude,
      })
      .zAdd(PROVIDER_HEARTBEAT_KEY, {
        score: Date.now(),
        value: providerId,
      })
      .exec();
  }

  async remove(providerId: string): Promise<void> {
    const client = this.requireRealtimeClient();
    await client
      .multi()
      .zRem(PROVIDER_GEO_KEY, providerId)
      .zRem(PROVIDER_HEARTBEAT_KEY, providerId)
      .exec();
  }

  async isOnline(providerId: string): Promise<boolean> {
    const client = this.requireRealtimeClient();
    const lastHeartbeat = await client.zScore(
      PROVIDER_HEARTBEAT_KEY,
      providerId,
    );
    return (
      lastHeartbeat !== null &&
      lastHeartbeat >= Date.now() - this.providerLocationTtlSeconds * 1000
    );
  }

  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number,
  ): Promise<ProviderLocationPoint[]> {
    const client = this.requireRealtimeClient();
    // Atomic cleanup avoids deleting a location refreshed concurrently by a heartbeat.
    await client.eval(
      `
      local ids = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', ARGV[1], 'LIMIT', 0, 1000)
      for _, id in ipairs(ids) do
        redis.call('ZREM', KEYS[1], id)
        redis.call('ZREM', KEYS[2], id)
      end
      return #ids
    `,
      {
        keys: [PROVIDER_GEO_KEY, PROVIDER_HEARTBEAT_KEY],
        arguments: [
          String(Date.now() - this.providerLocationTtlSeconds * 1000),
        ],
      },
    );
    const candidates = await client.geoSearchWith(
      PROVIDER_GEO_KEY,
      { latitude, longitude },
      { radius: radiusKm, unit: 'km' },
      ['WITHDIST'],
      { SORT: 'ASC', COUNT: Math.min(limit * 3, 300) },
    );
    if (!candidates.length) return [];

    const providerIds = candidates.map((candidate) => String(candidate.member));
    const heartbeats = await client.zmScore(
      PROVIDER_HEARTBEAT_KEY,
      providerIds,
    );
    const freshAfter = Date.now() - this.providerLocationTtlSeconds * 1000;

    return candidates
      .filter((_, index) => {
        const heartbeat = heartbeats[index];
        return heartbeat !== null && heartbeat >= freshAfter;
      })
      .slice(0, limit)
      .map((candidate) => ({
        providerId: String(candidate.member),
        distanceKm: Number(candidate.distance ?? 0),
      }));
  }

  private requireRealtimeClient(): RedisClientType {
    if (!this.client?.isReady) {
      throw new ServiceUnavailableException(
        'Dịch vụ vị trí thời gian thực đang tạm thời không khả dụng.',
      );
    }
    return this.client;
  }

  async getPosition(
    providerId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const client = this.requireRealtimeClient();
    const result: unknown = await client.eval(
      `
      local heartbeat = redis.call('ZSCORE', KEYS[2], ARGV[1])
      if not heartbeat or tonumber(heartbeat) < tonumber(ARGV[2]) then return nil end
      return redis.call('GEOPOS', KEYS[1], ARGV[1])[1]
    `,
      {
        keys: [PROVIDER_GEO_KEY, PROVIDER_HEARTBEAT_KEY],
        arguments: [
          providerId,
          String(Date.now() - this.providerLocationTtlSeconds * 1000),
        ],
      },
    );
    if (!Array.isArray(result) || result.length !== 2) return null;
    return { longitude: Number(result[0]), latitude: Number(result[1]) };
  }

  async incrementRateLimit(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<RateLimitRecord> {
    const client = this.requireRealtimeClient();
    const namespace = `lambe:throttle:${throttlerName}:${key}`;
    const result: unknown = await client.eval(
      `
      local blockTtl = redis.call('PTTL', KEYS[2])
      if blockTtl > 0 then
        local current = tonumber(redis.call('GET', KEYS[1]) or ARGV[2])
        local counterTtl = redis.call('PTTL', KEYS[1])
        return {current, counterTtl, 1, blockTtl}
      end

      local hits = redis.call('INCR', KEYS[1])
      if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
      local counterTtl = redis.call('PTTL', KEYS[1])
      if hits > tonumber(ARGV[2]) then
        redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
        return {hits, counterTtl, 1, tonumber(ARGV[3])}
      end
      return {hits, counterTtl, 0, 0}
    `,
      {
        keys: [`${namespace}:count`, `${namespace}:block`],
        arguments: [String(ttl), String(limit), String(blockDuration)],
      },
    );
    if (!Array.isArray(result) || result.length !== 4) {
      throw new ServiceUnavailableException(
        'Redis trả về kết quả giới hạn truy cập không hợp lệ.',
      );
    }

    const [totalHits, timeToExpireMs, blocked, timeToBlockExpireMs] =
      result.map(Number);
    return {
      totalHits,
      timeToExpire: this.toSeconds(timeToExpireMs, ttl),
      isBlocked: blocked === 1,
      timeToBlockExpire: this.toSeconds(timeToBlockExpireMs, blockDuration),
    };
  }

  private toSeconds(milliseconds: number, fallback: number): number {
    const value = milliseconds > 0 ? milliseconds : fallback;
    return Math.max(1, Math.ceil(value / 1000));
  }

  private logOperationFailure(
    operation: string,
    key: string,
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.warn(`Redis ${operation} failed for '${key}': ${message}`);
  }
}
