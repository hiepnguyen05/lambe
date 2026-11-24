import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { performance } from 'node:perf_hooks';
import { createClient, TimeoutError, type RedisClientType } from 'redis';
import { MARKETPLACE_CACHE_KEYS } from '../../common/cache/marketplace-cache.constants';
import {
  ObservabilityMetrics,
  type CacheDomain,
  type RedisCommandGroup,
} from '../observability/observability-metrics.service';
import type {
  MemberLocationStore,
  MemberPosition,
} from '../location/member-location.store';
import type { CacheStatus, CacheStore } from './cache-store';
import type {
  ProviderLocationPoint,
  ProviderLocationStore,
  ProviderPosition,
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
  implements
    CacheStore,
    ProviderLocationStore,
    MemberLocationStore,
    OnModuleInit,
    OnModuleDestroy
{
  private readonly logger = new Logger(RedisCacheService.name);
  private client?: RedisClientType;
  private trackingSubscriber?: RedisClientType;
  private trackingSubscriberConnect?: Promise<void>;
  private shuttingDown = false;
  private commandGeneration = 0;
  private subscriberGeneration = 0;
  private readonly trackingListeners = new Map<
    string,
    { callbacks: Set<() => void>; ready: Promise<void> }
  >();
  private readonly trackingUnsubscribes = new Map<string, Promise<void>>();
  private readonly enabled: boolean;
  private readonly defaultTtlSeconds: number;
  private readonly providerLocationTtlSeconds: number;
  private readonly commandTimeoutMs: number;
  private readonly lastFailureLogAt = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly metrics?: ObservabilityMetrics,
  ) {
    this.enabled = this.configService.get<boolean>('cache.enabled', false);
    this.defaultTtlSeconds = this.configService.get<number>(
      'cache.defaultTtlSeconds',
      300,
    );
    this.providerLocationTtlSeconds = this.configService.get<number>(
      'cache.providerLocationTtlSeconds',
      120,
    );
    this.commandTimeoutMs = this.configService.get<number>(
      'cache.commandTimeoutMs',
      1000,
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
      disableOfflineQueue: true,
      commandsQueueMaxLength: 1000,
      socket: {
        connectTimeout: this.configService.get<number>(
          'cache.connectTimeoutMs',
          5000,
        ),
        reconnectStrategy: (retries) =>
          Math.min(3000, 100 * 2 ** Math.min(retries, 5)),
      },
    });
    this.client.on('error', () => {
      if (!this.shuttingDown) {
        this.metrics?.recordRedisConnection('commands', 'errors');
        this.logOperationFailure('connection');
      }
    });
    this.client.on('reconnecting', () => {
      if (!this.shuttingDown)
        this.metrics?.recordRedisConnection('commands', 'reconnects');
    });
    this.client.on('ready', () =>
      this.logger.log('Redis cache connected successfully.'),
    );

    try {
      await this.waitForConnection(this.client.connect(), 'commands');
    } catch {
      this.logger.warn(
        'Redis startup deadline reached; continuing while reconnect runs in background.',
      );
    }
  }

  onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    for (const client of [this.trackingSubscriber, this.client]) {
      if (!client?.isOpen) continue;
      // close() waits for replies forever when a peer keeps the socket open.
      client.destroy();
    }
    this.trackingListeners.clear();
    return Promise.resolve();
  }

  async get<T>(key: string): Promise<T | null> {
    const client = this.client;
    if (!client?.isReady) {
      if (this.enabled) this.recordCacheLookup(key, 'errors');
      return null;
    }

    try {
      const value = await this.observeCommand('read', () =>
        client.withCommandOptions({ timeout: this.commandTimeoutMs }).get(key),
      );
      if (value === null) {
        this.recordCacheLookup(key, 'misses');
        return null;
      }
      try {
        const parsed = JSON.parse(value) as T;
        this.recordCacheLookup(key, parsed === null ? 'misses' : 'hits');
        return parsed;
      } catch {
        this.recordCacheLookup(key, 'misses');
        return null;
      }
    } catch {
      this.recordCacheLookup(key, 'errors');
      this.logOperationFailure('read');
      return null;
    }
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    if (!keys.length) return [];
    const client = this.client;
    if (!client?.isReady) {
      if (this.enabled)
        for (const key of keys) this.recordCacheLookup(key, 'errors');
      return keys.map(() => null);
    }
    try {
      const values = await this.observeCommand('batchRead', () =>
        client
          .withCommandOptions({ timeout: this.commandTimeoutMs })
          .mGet(keys),
      );
      return values.map((value, index) => {
        if (value === null) {
          this.recordCacheLookup(keys[index], 'misses');
          return null;
        }
        try {
          const parsed = JSON.parse(value) as T;
          this.recordCacheLookup(
            keys[index],
            parsed === null ? 'misses' : 'hits',
          );
          return parsed;
        } catch {
          this.recordCacheLookup(keys[index], 'misses');
          return null;
        }
      });
    } catch {
      for (const key of keys) this.recordCacheLookup(key, 'errors');
      this.logOperationFailure('batch_read');
      return keys.map(() => null);
    }
  }

  private recordCacheLookup(
    key: string,
    outcome: 'hits' | 'misses' | 'errors',
  ) {
    const domain: CacheDomain = key.startsWith('lambe:feed:v1:post:')
      ? 'feedPosts'
      : key === MARKETPLACE_CACHE_KEYS.activeCategories
        ? 'categories'
        : key === MARKETPLACE_CACHE_KEYS.activeServices
          ? 'services'
          : 'other';
    this.metrics?.recordCacheLookup(domain, outcome);
  }

  async setMany<T>(
    entries: { key: string; value: T }[],
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!this.client?.isReady) return false;
    try {
      const batch = this.client.multi();
      for (const entry of entries)
        batch.set(entry.key, JSON.stringify(entry.value), { EX: ttlSeconds });
      await this.observeCommand('write', () => batch.exec());
      return true;
    } catch {
      this.logOperationFailure('batch_write');
      return false;
    }
  }

  async deleteMany(keys: string[]): Promise<boolean> {
    const client = this.client;
    if (!client?.isReady) return false;
    if (!keys.length) return true;
    try {
      await this.observeCommand('write', () => client.del(keys));
      return true;
    } catch {
      this.logOperationFailure('batch_delete');
      return false;
    }
  }

  async setIfAbsent(
    key: string,
    token: string,
    ttlSeconds: number,
  ): Promise<boolean | null> {
    const client = this.client;
    if (!client?.isReady) return null;
    try {
      return (
        (await this.observeCommand('write', () =>
          client.set(key, token, { NX: true, EX: ttlSeconds }),
        )) === 'OK'
      );
    } catch {
      this.logOperationFailure('lock');
      return null;
    }
  }

  async releaseLock(key: string, token: string): Promise<void> {
    const client = this.client;
    if (!client?.isReady) return;
    try {
      await this.observeCommand('write', () =>
        client.eval(
          "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
          { keys: [key], arguments: [token] },
        ),
      );
    } catch {
      this.logOperationFailure('unlock');
    }
  }

  async replaceSortedPage(
    key: string,
    members: string[],
    ttlSeconds: number,
  ): Promise<boolean> {
    const client = this.client;
    if (!client?.isReady) return false;
    try {
      await this.observeCommand('write', () =>
        client.eval(
          `
        redis.call('DEL',KEYS[1])
        for i=2,#ARGV do redis.call('ZADD',KEYS[1],0,ARGV[i]) end
        redis.call('EXPIRE',KEYS[1],ARGV[1])
        redis.call('SET',KEYS[2],#ARGV-1,'EX',ARGV[1])
        return 1
      `,
          {
            keys: [key, `${key}:count`],
            arguments: [String(ttlSeconds), ...members],
          },
        ),
      );
      return true;
    } catch {
      this.logOperationFailure('index_write');
      return false;
    }
  }

  async readSortedPage(key: string, limit: number): Promise<string[] | null> {
    const client = this.client;
    if (!client?.isReady) return null;
    try {
      const result: unknown = await this.observeCommand('read', () =>
        client.eval(
          `
        local n=redis.call('GET',KEYS[2])
        if not n then return false end
        if tonumber(n)>tonumber(ARGV[1]) then return false end
        local values=redis.call('ZREVRANGE',KEYS[1],0,tonumber(ARGV[1])-1)
        if #values~=tonumber(n) then return false end
        return values
      `,
          { keys: [key, `${key}:count`], arguments: [String(limit)] },
        ),
      );
      return Array.isArray(result) &&
        result.every((value) => typeof value === 'string')
        ? result
        : null;
    } catch {
      this.logOperationFailure('index_read');
      return null;
    }
  }

  async advanceGeneration(
    key: string,
    sequence: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const client = this.client;
    if (!client?.isReady) return false;
    try {
      await this.observeCommand('write', () =>
        client.eval(
          `
        local previous=redis.call('GET',KEYS[1])
        if not previous or previous<ARGV[1] then redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]) end
        return 1
      `,
          {
            keys: [key],
            arguments: [sequence.padStart(20, '0'), String(ttlSeconds)],
          },
        ),
      );
      return true;
    } catch {
      this.logOperationFailure('generation');
      return false;
    }
  }

  async getTracking<T>(orderId: string): Promise<T | null> {
    const client = this.requireRealtimeClient();
    const value = await this.observeCommand('tracking', () =>
      client.hGet(`lambe:orders:tracking:${orderId}`, 'payload'),
    );
    return value ? (JSON.parse(value) as T) : null;
  }

  async saveTrackingIfNewer(
    orderId: string,
    snapshot: { capturedAtMs: number },
  ): Promise<boolean> {
    const client = this.requireRealtimeClient();
    const result = await this.observeCommand('tracking', () =>
      client.eval(
        `
      local previous = redis.call('HGET', KEYS[1], 'capturedAtMs')
      if previous and tonumber(previous) >= tonumber(ARGV[1]) then return 0 end
      redis.call('HSET', KEYS[1], 'capturedAtMs', ARGV[1], 'payload', ARGV[2])
      redis.call('EXPIRE', KEYS[1], 120)
      return 1
      `,
        {
          keys: [`lambe:orders:tracking:${orderId}`],
          arguments: [String(snapshot.capturedAtMs), JSON.stringify(snapshot)],
        },
      ),
    );
    if (result !== 1) return false;
    try {
      await this.observeCommand('publish', () =>
        client.publish(`lambe:orders:tracking:events:${orderId}`, 'updated'),
      );
    } catch {
      this.logger.warn('Redis tracking notification unavailable.');
    }
    return true;
  }

  async subscribeTracking(
    orderId: string,
    listener: () => void,
  ): Promise<() => Promise<void>> {
    return this.subscribeChannel(
      `lambe:orders:tracking:events:${orderId}`,
      listener,
    );
  }

  async publishOrderNotification(userId: string): Promise<void> {
    await this.observeCommand('publish', () =>
      this.requireRealtimeClient().publish(
        `lambe:orders:notifications:${userId}`,
        'updated',
      ),
    );
  }

  async subscribeOrderNotifications(
    userId: string,
    listener: () => void,
  ): Promise<() => Promise<void>> {
    return this.subscribeChannel(
      `lambe:orders:notifications:${userId}`,
      listener,
    );
  }

  async publishChatUpdate(conversationId: string): Promise<void> {
    try {
      await this.observeCommand('publish', () =>
        this.requireRealtimeClient().publish(
          `lambe:chat:events:${conversationId}`,
          'updated',
        ),
      );
    } catch {
      this.logger.warn('Redis chat notification unavailable.');
    }
  }

  async subscribeChatUpdates(
    conversationId: string,
    listener: () => void,
  ): Promise<() => Promise<void>> {
    return this.subscribeChannel(
      `lambe:chat:events:${conversationId}`,
      listener,
    );
  }

  private async subscribeChannel(
    channel: string,
    listener: () => void,
  ): Promise<() => Promise<void>> {
    const client = this.requireRealtimeClient();
    if (!this.trackingSubscriber) {
      // Queue subscription cleanup across reconnect; business commands never queue offline.
      this.trackingSubscriber = client.duplicate({
        disableOfflineQueue: false,
      });
      this.trackingSubscriber.on('error', () => {
        if (!this.shuttingDown) {
          this.metrics?.recordRedisConnection('subscriber', 'errors');
          this.logOperationFailure('subscription');
        }
      });
      this.trackingSubscriber.on('reconnecting', () => {
        if (!this.shuttingDown)
          this.metrics?.recordRedisConnection('subscriber', 'reconnects');
      });
      this.trackingSubscriberConnect = this.trackingSubscriber
        .connect()
        .then(() => undefined);
    }
    await this.waitForConnection(this.trackingSubscriberConnect!, 'subscriber');
    const subscriber = this.trackingSubscriber;
    await this.trackingUnsubscribes.get(channel);
    let entry = this.trackingListeners.get(channel);
    if (!entry) {
      const callbacks = new Set<() => void>();
      const ready = this.observeSubscriberCommand(() =>
        subscriber
          .subscribe(channel, () => {
            for (const callback of this.trackingListeners.get(channel)
              ?.callbacks ?? []) {
              callback();
            }
          })
          .then(() => undefined),
      );
      entry = { callbacks, ready };
      this.trackingListeners.set(channel, entry);
    }
    entry.callbacks.add(listener);
    try {
      await entry.ready;
    } catch (error: unknown) {
      entry.callbacks.delete(listener);
      if (
        this.trackingListeners.get(channel) === entry &&
        !entry.callbacks.size
      ) {
        this.trackingListeners.delete(channel);
      }
      throw error;
    }
    return async () => {
      entry.callbacks.delete(listener);
      if (
        this.trackingListeners.get(channel) === entry &&
        !entry.callbacks.size
      ) {
        this.trackingListeners.delete(channel);
        if (subscriber.isOpen) {
          const pending = this.observeSubscriberCommand(() =>
            subscriber.unsubscribe(channel),
          );
          this.trackingUnsubscribes.set(channel, pending);
          try {
            await pending;
          } finally {
            if (this.trackingUnsubscribes.get(channel) === pending) {
              this.trackingUnsubscribes.delete(channel);
            }
          }
        }
      }
    };
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const client = this.client;
    if (!client?.isReady) return;

    try {
      await this.observeCommand('write', () =>
        client.set(key, JSON.stringify(value), {
          expiration: {
            type: 'EX',
            value: ttlSeconds ?? this.defaultTtlSeconds,
          },
        }),
      );
    } catch {
      this.logOperationFailure('write');
    }
  }

  async delete(key: string): Promise<void> {
    const client = this.client;
    if (!client?.isReady) return;

    try {
      await this.observeCommand('write', () => client.del(key));
    } catch {
      this.logOperationFailure('delete');
    }
  }

  getStatus(): CacheStatus {
    if (!this.enabled) return 'disabled';
    return this.client?.isReady ? 'up' : 'down';
  }

  async upsert(position: ProviderPosition): Promise<boolean> {
    const client = this.requireRealtimeClient();
    const result = await this.observeCommand('tracking', () =>
      client.eval(
        `
      local previousSequence = tonumber(redis.call('HGET', KEYS[3], 'sequence') or '-1')
      local previousCaptured = tonumber(redis.call('HGET', KEYS[3], 'capturedAtMs') or '-1')
      if previousSequence >= tonumber(ARGV[7]) or previousCaptured >= tonumber(ARGV[6]) then return 0 end
      if tonumber(ARGV[6]) < tonumber(ARGV[8]) - 60000 or tonumber(ARGV[6]) > tonumber(ARGV[8]) + 15000 then return 0 end
      redis.call('GEOADD', KEYS[1], ARGV[4], ARGV[5], ARGV[1])
      redis.call('ZADD', KEYS[2], ARGV[8], ARGV[1])
      redis.call('HSET', KEYS[3], 'sessionId', ARGV[2], 'accuracyMeters', ARGV[3], 'capturedAtMs', ARGV[6], 'sequence', ARGV[7])
      redis.call('EXPIRE', KEYS[3], ARGV[9])
      return 1
      `,
        {
          keys: [
            PROVIDER_GEO_KEY,
            PROVIDER_HEARTBEAT_KEY,
            `lambe:providers:online:state:${position.providerId}`,
          ],
          arguments: [
            position.providerId,
            position.sessionId,
            String(position.accuracyMeters),
            String(position.longitude),
            String(position.latitude),
            String(position.capturedAtMs),
            String(position.sequence),
            String(Date.now()),
            String(this.providerLocationTtlSeconds + 120),
          ],
        },
      ),
    );
    return result === 1;
  }

  async remove(providerId: string): Promise<void> {
    const client = this.requireRealtimeClient();
    await this.observeCommand('tracking', () =>
      client
        .multi()
        .zRem(PROVIDER_GEO_KEY, providerId)
        .zRem(PROVIDER_HEARTBEAT_KEY, providerId)
        .del(`lambe:providers:online:state:${providerId}`)
        .exec(),
    );
  }

  async isOnline(providerId: string): Promise<boolean> {
    const client = this.requireRealtimeClient();
    const lastHeartbeat = await this.observeCommand('tracking', () =>
      client.zScore(PROVIDER_HEARTBEAT_KEY, providerId),
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
    await this.observeCommand('tracking', () =>
      client.eval(
        `
      local ids = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', ARGV[1], 'LIMIT', 0, 1000)
      for _, id in ipairs(ids) do
        redis.call('ZREM', KEYS[1], id)
        redis.call('ZREM', KEYS[2], id)
        redis.call('DEL', 'lambe:providers:online:state:' .. id)
      end
      return #ids
    `,
        {
          keys: [PROVIDER_GEO_KEY, PROVIDER_HEARTBEAT_KEY],
          arguments: [
            String(Date.now() - this.providerLocationTtlSeconds * 1000),
          ],
        },
      ),
    );
    const candidates = await this.observeCommand('tracking', () =>
      client.geoSearchWith(
        PROVIDER_GEO_KEY,
        { latitude, longitude },
        { radius: radiusKm, unit: 'km' },
        ['WITHDIST'],
        { SORT: 'ASC', COUNT: Math.min(limit * 3, 300) },
      ),
    );
    if (!candidates.length) return [];

    const providerIds = candidates.map((candidate) => String(candidate.member));
    const heartbeats = await this.observeCommand('tracking', () =>
      client.zmScore(PROVIDER_HEARTBEAT_KEY, providerIds),
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

  async saveMemberPosition(position: MemberPosition): Promise<boolean> {
    const result = await this.evaluateMemberLocation(
      `
      local version = tonumber(redis.call('HGET', KEYS[3], 'version') or '-1')
      local session = redis.call('HGET', KEYS[3], 'session')
      local captured = tonumber(redis.call('HGET', KEYS[3], 'captured') or '-1')
      if version > tonumber(ARGV[2]) then return 0 end
      if version == tonumber(ARGV[2]) and (session ~= ARGV[3] or captured > tonumber(ARGV[6])) then return 0 end
      if tonumber(ARGV[6]) < tonumber(ARGV[7]) - 60000 or tonumber(ARGV[6]) > tonumber(ARGV[7]) + 15000 then return 0 end
      redis.call('GEOADD', KEYS[1], ARGV[4], ARGV[5], ARGV[1])
      redis.call('ZADD', KEYS[2], ARGV[7], ARGV[1])
      redis.call('HSET', KEYS[3], 'version', ARGV[2], 'session', ARGV[3], 'captured', ARGV[6])
      redis.call('EXPIRE', KEYS[3], ARGV[8])
      local stale = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', tonumber(ARGV[7]) - tonumber(ARGV[9]), 'LIMIT', 0, 100)
      for _, id in ipairs(stale) do redis.call('ZREM', KEYS[1], id); redis.call('ZREM', KEYS[2], id) end
      return 1
    `,
      {
        keys: [
          'lambe:members:online:geo',
          'lambe:members:online:heartbeat',
          `lambe:members:online:session:${position.memberId}`,
        ],
        arguments: [
          position.memberId,
          String(position.version),
          position.sessionId,
          String(position.longitude),
          String(position.latitude),
          String(position.capturedAtMs),
          String(Date.now()),
          String(this.providerLocationTtlSeconds + 120),
          String(this.providerLocationTtlSeconds * 1000),
        ],
      },
    );
    return result === 1;
  }

  async findNearbyMembers(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number,
  ) {
    const client = this.requireRealtimeClient();
    await this.evaluateMemberLocation(
      `
      local ids = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', ARGV[1], 'LIMIT', 0, 1000)
      for _, id in ipairs(ids) do redis.call('ZREM', KEYS[1], id); redis.call('ZREM', KEYS[2], id) end
      return #ids
    `,
      {
        keys: ['lambe:members:online:geo', 'lambe:members:online:heartbeat'],
        arguments: [
          String(Date.now() - this.providerLocationTtlSeconds * 1000),
        ],
      },
    );
    const candidates = await this.observeCommand('tracking', () =>
      client.geoSearchWith(
        'lambe:members:online:geo',
        { latitude, longitude },
        { radius: radiusKm, unit: 'km' },
        ['WITHDIST'],
        { SORT: 'ASC', COUNT: Math.min(limit * 3, 900) },
      ),
    );
    if (!candidates.length) return [];
    const ids = candidates.map((c) => String(c.member));
    const batch = client.multi();
    for (const id of ids)
      batch.hGet(`lambe:members:online:session:${id}`, 'session');
    const [scores, sessions] = await Promise.all([
      this.observeCommand('tracking', () =>
        client.zmScore('lambe:members:online:heartbeat', ids),
      ),
      this.observeCommand('tracking', () => batch.exec()),
    ]);
    const cutoff = Date.now() - this.providerLocationTtlSeconds * 1000;
    return candidates
      .flatMap((c, i) =>
        scores[i] !== null &&
        scores[i] > cutoff &&
        typeof sessions[i] === 'string' &&
        sessions[i]
          ? [
              {
                memberId: ids[i],
                distanceKm: Number(c.distance ?? 0),
                sessionId: String(sessions[i]),
              },
            ]
          : [],
      )
      .slice(0, limit);
  }

  async removeMemberPosition(memberId: string, version: number): Promise<void> {
    await this.evaluateMemberLocation(
      `
      local previous = tonumber(redis.call('HGET', KEYS[3], 'version') or '-1')
      if previous > tonumber(ARGV[2]) then return 0 end
      redis.call('ZREM', KEYS[1], ARGV[1]); redis.call('ZREM', KEYS[2], ARGV[1])
      redis.call('HSET', KEYS[3], 'version', ARGV[2], 'session', '', 'captured', '-1')
      redis.call('EXPIRE', KEYS[3], ARGV[3]); return 1
    `,
      {
        keys: [
          'lambe:members:online:geo',
          'lambe:members:online:heartbeat',
          `lambe:members:online:session:${memberId}`,
        ],
        arguments: [
          memberId,
          String(version),
          String(this.providerLocationTtlSeconds + 120),
        ],
      },
    );
  }

  async getMemberPosition(
    memberId: string,
    sessionId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const result: unknown = await this.evaluateMemberLocation(
      `
      if redis.call('HGET', KEYS[3], 'session') ~= ARGV[2] then return nil end
      local heartbeat = tonumber(redis.call('ZSCORE', KEYS[2], ARGV[1]) or '-1')
      if heartbeat <= tonumber(ARGV[3]) then return nil end
      return redis.call('GEOPOS', KEYS[1], ARGV[1])[1]
    `,
      {
        keys: [
          'lambe:members:online:geo',
          'lambe:members:online:heartbeat',
          `lambe:members:online:session:${memberId}`,
        ],
        arguments: [
          memberId,
          sessionId,
          String(Date.now() - this.providerLocationTtlSeconds * 1000),
        ],
      },
    );
    if (!Array.isArray(result) || result.length !== 2) return null;
    return { longitude: Number(result[0]), latitude: Number(result[1]) };
  }

  private async evaluateMemberLocation(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown> {
    try {
      return await this.observeCommand('tracking', () =>
        this.requireRealtimeClient().eval(script, options),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Dịch vụ vị trí thành viên tạm thời không khả dụng.',
      );
    }
  }

  async getPosition(
    providerId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const client = this.requireRealtimeClient();
    const result: unknown = await this.observeCommand('tracking', () =>
      client.eval(
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
      ),
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
    deadlineMs?: number,
  ): Promise<RateLimitRecord> {
    const client = this.requireRealtimeClient();
    const namespace = `lambe:throttle:${throttlerName}:${key}`;
    const result: unknown = await this.observeCommand(
      'rateLimit',
      () =>
        client
          .withCommandOptions({
            timeout: Math.min(
              this.commandTimeoutMs,
              deadlineMs ?? this.commandTimeoutMs,
            ),
          })
          .eval(
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
          ),
      Math.min(this.commandTimeoutMs, deadlineMs ?? this.commandTimeoutMs),
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

  private logOperationFailure(operation: string): void {
    const now = Date.now();
    if (now - (this.lastFailureLogAt.get(operation) ?? -Infinity) < 30_000)
      return;
    this.lastFailureLogAt.set(operation, now);
    this.logger.warn(`Redis cache ${operation} failed.`);
  }

  private async observeCommand<T>(
    group: RedisCommandGroup,
    work: () => Promise<T>,
    deadlineMs = this.commandTimeoutMs,
  ): Promise<T> {
    const started = performance.now();
    const client = this.client;
    const generation = this.commandGeneration;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failed = true;
    let timedOut = false;
    try {
      // node-redis's native timeout stops once the command is written to its
      // socket. Bound the reply wait too; never replay an ambiguous mutation.
      const result = await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new TimeoutError());
            if (client?.isOpen && generation === this.commandGeneration) {
              this.commandGeneration++;
              client.destroy();
              if (!this.shuttingDown) {
                this.metrics?.recordRedisConnection('commands', 'reconnects');
                void client
                  .connect()
                  .catch(() => this.logOperationFailure('connection'));
              }
            }
          }, deadlineMs);
        }),
      ]);
      failed = false;
      return result;
    } catch (error: unknown) {
      if (error instanceof TimeoutError) {
        timedOut = true;
        throw new ServiceUnavailableException(
          'Redis command deadline exceeded.',
        );
      }
      if (group === 'rateLimit')
        throw new ServiceUnavailableException(
          'Redis rate limiting unavailable.',
        );
      throw error;
    } finally {
      clearTimeout(timer);
      this.metrics?.recordRedisCommand(
        group,
        performance.now() - started,
        failed,
        timedOut,
      );
    }
  }

  private async waitForConnection(
    connection: Promise<unknown>,
    role: 'commands' | 'subscriber',
  ) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        connection,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => {
              this.metrics?.recordRedisConnection(role, 'timeouts');
              reject(new Error('Redis connection deadline'));
            },
            this.configService.get<number>('cache.connectTimeoutMs', 5000),
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async observeSubscriberCommand<T>(
    work: () => Promise<T>,
  ): Promise<T> {
    const subscriber = this.trackingSubscriber;
    const generation = this.subscriberGeneration;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            this.metrics?.recordRedisConnection('subscriber', 'timeouts');
            reject(
              new ServiceUnavailableException(
                'Redis subscriber deadline exceeded.',
              ),
            );
            if (
              subscriber?.isOpen &&
              generation === this.subscriberGeneration
            ) {
              this.subscriberGeneration++;
              subscriber.destroy();
              if (!this.shuttingDown) {
                this.metrics?.recordRedisConnection('subscriber', 'reconnects');
                this.trackingSubscriberConnect = subscriber
                  .connect()
                  .then(() => undefined)
                  .catch(() => this.logOperationFailure('subscription'));
              }
            }
          }, this.commandTimeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
