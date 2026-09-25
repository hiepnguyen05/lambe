import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';
import type { CacheStatus, CacheStore } from './cache-store';

@Injectable()
export class RedisCacheService
  implements CacheStore, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisCacheService.name);
  private client?: RedisClientType;
  private readonly enabled: boolean;
  private readonly defaultTtlSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('cache.enabled', false);
    this.defaultTtlSeconds = this.configService.get<number>(
      'cache.defaultTtlSeconds',
      300,
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

  private logOperationFailure(
    operation: string,
    key: string,
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.warn(`Redis ${operation} failed for '${key}': ${message}`);
  }
}
