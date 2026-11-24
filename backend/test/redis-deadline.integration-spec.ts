import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createConnection, createServer, type Socket } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from 'redis';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service';
import { ObservabilityMetrics } from '../src/infrastructure/observability/observability-metrics.service';
import { requireIsolatedTestRedis } from './support/isolated-test-redis';

async function eventually(predicate: () => boolean | Promise<boolean>) {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    if (await predicate()) return;
    await delay(25);
  }
  throw new Error('Redis recovery deadline exceeded');
}

// Real Redis behind a loopback TCP proxy. Faults affect this suite's sockets only.
// No service restart, FLUSHDB, shared key deletion or remote fault injection.
describe('Redis command deadlines and two-client recovery', () => {
  const sockets = new Set<Socket>();
  const upstreams = new Set<Socket>();
  const clients: RedisCacheService[] = [];
  const metrics = new ObservabilityMetrics();
  let target: URL;
  let url: string;
  let observer: ReturnType<typeof createClient>;
  let stalled = false;
  const proxy = createServer((downstream) => {
    const upstream = createConnection({
      host: target.hostname,
      port: Number(target.port || 6379),
    });
    sockets.add(downstream);
    sockets.add(upstream);
    upstreams.add(upstream);
    for (const socket of [downstream, upstream]) {
      socket.on('error', () => undefined);
      socket.on('close', () => {
        sockets.delete(socket);
        upstreams.delete(socket);
        downstream.destroy();
        upstream.destroy();
      });
    }
    downstream.pipe(upstream);
    upstream.pipe(downstream);
    if (stalled) upstream.pause();
  });
  const stall = (value: boolean) => {
    stalled = value;
    for (const socket of upstreams) {
      if (value) socket.pause();
      else socket.resume();
    }
  };
  async function cache() {
    const service = new RedisCacheService(
      new ConfigService({
        cache: {
          enabled: true,
          url,
          commandTimeoutMs: 100,
          connectTimeoutMs: 500,
        },
      }),
      metrics,
    );
    clients.push(service);
    await service.onModuleInit();
    expect(service.getStatus()).toBe('up');
    return service;
  }

  beforeAll(async () => {
    target = new URL(requireIsolatedTestRedis(process.env));
    observer = createClient({
      url: target.href,
      socket: { reconnectStrategy: false },
    });
    observer.on('error', () => undefined);
    await observer.connect();
    await new Promise<void>((resolve, reject) => {
      proxy.once('error', reject);
      proxy.listen(0, '127.0.0.1', resolve);
    });
    const address = proxy.address();
    if (!address || typeof address === 'string')
      throw new Error('No proxy port');
    const proxied = new URL(target.href);
    proxied.hostname = '127.0.0.1';
    proxied.port = String(address.port);
    url = proxied.href;
  });
  afterAll(async () => {
    stall(false);
    await Promise.all(clients.map((client) => client.onModuleDestroy()));
    for (const socket of sockets) socket.destroy();
    if (proxy.listening)
      await new Promise<void>((resolve) => proxy.close(() => resolve()));
    if (observer?.isOpen) observer.destroy();
    metrics.onModuleDestroy();
  });

  it('bounds half-open reads and protected rate limits, then consumes late replies correctly', async () => {
    const client = await cache();
    const key = `lambe:test:deadline:${randomUUID()}`;
    await observer.set(key, JSON.stringify({ value: 1 }), { EX: 30 });
    expect(await client.get(key)).toEqual({ value: 1 });
    // Recover between faults: a deadline may retire the whole stalled socket.
    for (const operation of [
      async () => expect(await client.get(key)).toBeNull(),
      async () =>
        expect(await client.getMany([key, `${key}:missing`])).toEqual([
          null,
          null,
        ]),
      async () => {
        await expect(
          client.incrementRateLimit(key, 1000, 2, 1000, 'test'),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
      },
    ]) {
      stall(true);
      try {
        const began = performance.now();
        await operation();
        expect(performance.now() - began).toBeLessThan(1500);
      } finally {
        stall(false);
      }
      await eventually(
        async () => JSON.stringify(await client.get(key)) === '{"value":1}',
      );
    }
    expect(metrics.snapshot().redis.commands.read.timeouts).toBe(1);
    expect(metrics.snapshot().redis.commands.batchRead.timeouts).toBe(1);
    expect(metrics.snapshot().redis.commands.rateLimit.timeouts).toBe(1);
    await observer.del(key);
  });

  it('restores Pub/Sub between two instances after socket loss without leaking callbacks', async () => {
    const subscriber = await cache();
    const publisher = await cache();
    const channel = randomUUID();
    let received = 0;
    let unsubscribe = await subscriber.subscribeChatUpdates(
      channel,
      () => received++,
    );
    try {
      await publisher.publishChatUpdate(channel);
      await eventually(() => received === 1);
      for (const socket of [...sockets]) socket.destroy();
      await eventually(
        () => subscriber.getStatus() === 'up' && publisher.getStatus() === 'up',
      );
      await eventually(async () => {
        await publisher.publishChatUpdate(channel);
        return received >= 2;
      });
      await unsubscribe();
      // Allow any already published messages to drain before checking listener cleanup.
      await delay(50);
      for (let i = 0; i < 10; i++) {
        const before = received;
        unsubscribe = await subscriber.subscribeChatUpdates(
          channel,
          () => received++,
        );
        await publisher.publishChatUpdate(channel);
        await eventually(() => received === before + 1);
        await unsubscribe();
        await publisher.publishChatUpdate(channel);
        await delay(25);
        expect(received).toBe(before + 1);
      }
      expect(
        metrics.snapshot().redis.connections.subscriber.reconnects,
      ).toBeGreaterThan(0);
    } finally {
      await unsubscribe();
    }
  });

  it('finishes shutdown with an in-flight half-open read and does not reconnect', async () => {
    const client = await cache();
    const key = `lambe:test:shutdown-deadline:${randomUUID()}`;
    await observer.set(key, JSON.stringify({ value: 3 }), { EX: 30 });
    const reconnects = metrics.snapshot().redis.connections.commands.reconnects;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finished: Promise<unknown> | undefined;
    stall(true);
    try {
      const read = client.get(key);
      // Let the request reach Redis while the proxy withholds its response.
      await delay(20);
      const began = performance.now();
      finished = Promise.all([client.onModuleDestroy(), read]);
      const result = await Promise.race([
        finished,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Shutdown waited for the half-open socket')),
            1500,
          );
        }),
      ]);
      expect(performance.now() - began).toBeLessThan(1500);
      expect(result).toEqual([undefined, null]);
      expect(client.getStatus()).toBe('down');
      stall(false);
      await delay(250);
      expect(client.getStatus()).toBe('down');
      expect(metrics.snapshot().redis.connections.commands.reconnects).toBe(
        reconnects,
      );
    } finally {
      clearTimeout(timer);
      stall(false);
      await finished;
      await observer.del(key);
    }
  });

  it('bounds cache writes and tracking reads while the server has stopped replying', async () => {
    const client = await cache();
    const key = `lambe:test:write-deadline:${randomUUID()}`;
    for (const operation of [
      () => client.set(key, { value: 2 }, 30),
      () => client.getTracking(randomUUID()),
    ]) {
      stall(true);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const outcome = operation().then(
          () => 'resolved',
          (error: unknown) => {
            expect(error).toBeInstanceOf(ServiceUnavailableException);
            return 'unavailable';
          },
        );
        await Promise.race([
          outcome,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error('Application deadline did not bound reply wait'),
                ),
              1500,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
        stall(false);
      }
      await eventually(() => client.getStatus() === 'up');
    }
    await observer.del(key);
  });

  it('fails closed when a provider location lookup has no Redis reply', async () => {
    const client = await cache();
    stall(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        expect(client.getPosition(randomUUID())).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Location reply wait was unbounded')),
            1500,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
      stall(false);
    }
  });

  it('bounds provider and member location mutations when Redis stops replying', async () => {
    const client = await cache();
    const providerId = randomUUID();
    const memberId = randomUUID();
    const capturedAtMs = Date.now();
    const operations = [
      () =>
        client.upsert({
          providerId,
          sessionId: randomUUID(),
          latitude: 10.7731,
          longitude: 106.703,
          accuracyMeters: 5,
          capturedAtMs,
          sequence: 1,
        }),
      () =>
        client.saveMemberPosition({
          memberId,
          sessionId: randomUUID(),
          version: 1,
          latitude: 10.7731,
          longitude: 106.703,
          capturedAtMs,
        }),
    ];
    try {
      for (const operation of operations) {
        stall(true);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            expect(operation()).rejects.toBeInstanceOf(
              ServiceUnavailableException,
            ),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () =>
                  reject(
                    new Error('Location mutation reply wait was unbounded'),
                  ),
                1500,
              );
            }),
          ]);
        } finally {
          clearTimeout(timer);
          stall(false);
        }
        await eventually(() => client.getStatus() === 'up');
      }
    } finally {
      stall(false);
      await client.remove(providerId);
      await client.removeMemberPosition(memberId, 2);
    }
  });

  it('bounds nearby, online, member and order-tracking replies', async () => {
    const client = await cache();
    const id = randomUUID();
    const operations = [
      () => client.isOnline(id),
      () => client.findNearby(10.7731, 106.703, 5, 10),
      () => client.findNearbyMembers(10.7731, 106.703, 5, 10),
      () => client.getMemberPosition(id, randomUUID()),
      () => client.saveTrackingIfNewer(id, { capturedAtMs: Date.now() }),
    ];
    for (const operation of operations) {
      await eventually(() => client.getStatus() === 'up');
      stall(true);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          expect(operation()).rejects.toBeInstanceOf(
            ServiceUnavailableException,
          ),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Realtime reply wait was unbounded')),
              1500,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
        stall(false);
      }
    }
  });

  it('bounds cache index and lock operations with their safe fallbacks', async () => {
    const client = await cache();
    const key = `lambe:test:cache-ops:${randomUUID()}`;
    const operations: Array<() => Promise<unknown>> = [
      async () => expect(await client.setIfAbsent(key, 'token', 30)).toBeNull(),
      async () =>
        expect(await client.setMany([{ key, value: 1 }], 30)).toBe(false),
      async () => expect(await client.deleteMany([key])).toBe(false),
      async () =>
        expect(await client.replaceSortedPage(key, ['a'], 30)).toBe(false),
      async () => expect(await client.readSortedPage(key, 10)).toBeNull(),
      async () =>
        expect(await client.advanceGeneration(key, '1', 30)).toBe(false),
      async () => client.releaseLock(key, 'token'),
      async () => client.delete(key),
    ];
    for (const operation of operations) {
      await eventually(() => client.getStatus() === 'up');
      stall(true);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          operation(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Cache command reply wait was unbounded')),
              1500,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
        stall(false);
      }
    }
    await observer.del([key, `${key}:count`]);
  });

  it('bounds a half-open subscriber acknowledgement and restores existing listeners', async () => {
    const client = await cache();
    const existingOrderId = randomUUID();
    const newOrderId = randomUUID();
    let received = 0;
    let failedListenerCalls = 0;
    const unsubscribeExisting = await client.subscribeTracking(
      existingOrderId,
      () => received++,
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      stall(true);
      await Promise.race([
        expect(
          client.subscribeTracking(newOrderId, () => failedListenerCalls++),
        ).rejects.toBeInstanceOf(ServiceUnavailableException),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Subscriber acknowledgement was unbounded')),
            1500,
          );
        }),
      ]);
      stall(false);
      await eventually(async () => {
        await observer.publish(
          `lambe:orders:tracking:events:${existingOrderId}`,
          'updated',
        );
        return received > 0;
      });
      await observer.publish(
        `lambe:orders:tracking:events:${newOrderId}`,
        'updated',
      );
      await delay(50);
      expect(failedListenerCalls).toBe(0);
      const unsubscribeNew = await client.subscribeTracking(
        newOrderId,
        () => undefined,
      );
      await unsubscribeNew();
    } finally {
      clearTimeout(timer);
      stall(false);
      await unsubscribeExisting();
    }
  });
});
