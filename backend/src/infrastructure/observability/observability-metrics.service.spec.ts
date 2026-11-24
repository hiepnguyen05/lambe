import {
  boundedHttpRoute,
  OBSERVABILITY_LIMITS,
  ObservabilityMetrics,
} from './observability-metrics.service';

describe('ObservabilityMetrics', () => {
  it('counts all slow SQL events and samples the duration separately', () => {
    const metrics = new ObservabilityMetrics();
    for (let i = 1; i < OBSERVABILITY_LIMITS.querySampleEvery; i++) {
      metrics.recordPostgresQuery(OBSERVABILITY_LIMITS.slowQueryMs);
    }
    metrics.recordPostgresQuery(15);
    metrics.recordPostgresQuery(Number.NaN);

    expect(metrics.snapshot().postgresQueries).toMatchObject({
      observed: OBSERVABILITY_LIMITS.querySampleEvery,
      slow: OBSERVABILITY_LIMITS.querySampleEvery - 1,
      sampledDuration: { count: 1, totalMs: 15 },
    });
  });

  it('keeps route labels bounded and rejects raw URLs or private values', () => {
    expect(boundedHttpRoute('GET', '/orders/:id')).toEqual({
      verb: 'GET',
      path: '/orders/:id',
      label: 'GET /orders/:id',
    });
    for (const route of [
      '/orders/customer-123?token=secret',
      '/orders/customer@private',
      `/${'x'.repeat(241)}`,
    ]) {
      expect(boundedHttpRoute('TRACE', route)).toEqual({
        verb: 'OTHER',
        path: '<unmatched>',
        label: 'OTHER <unmatched>',
      });
    }
  });

  it('caps route cardinality, keeps existing routes and counts overflow', () => {
    const metrics = new ObservabilityMetrics();
    for (
      let index = 0;
      index < OBSERVABILITY_LIMITS.routeLabels + 10;
      index++
    ) {
      metrics.startHttp();
      metrics.finishHttp('GET', `/route-${index}`, 200, 12, false);
    }
    metrics.startHttp();
    metrics.finishHttp('GET', '/route-0', 503, 100, false);
    const snapshot = metrics.snapshot();
    expect(snapshot.http.active).toBe(0);
    expect(snapshot.http.routes).toHaveLength(OBSERVABILITY_LIMITS.routeLabels);
    expect(snapshot.http.overflow.completed).toBe(10);
    expect(snapshot.http.routes[0]).toMatchObject({
      completed: 2,
      serverErrors: 1,
      duration: { count: 2, totalMs: 112 },
    });
    expect(snapshot.http.routes[0].duration.buckets.slice(0, 3)).toEqual([
      0, 1, 1,
    ]);
  });

  it('records one SSE completion/error and never exposes a resume cursor', () => {
    const metrics = new ObservabilityMetrics();
    const stream = metrics.startSse('GET', '/orders/:id/events', true);
    expect(metrics.snapshot().http.routes[0].sse.active).toBe(1);
    stream.error();
    stream.error();
    stream.message();
    stream.message();
    stream.finish(70, true);
    stream.finish(70, true);
    expect(metrics.snapshot().http.routes[0].sse).toMatchObject({
      active: 0,
      opened: 1,
      errors: 1,
      aborted: 1,
      resumeSignals: 1,
      messages: 2,
      duration: { count: 1, totalMs: 70 },
    });
  });

  it('reports bounded process, event-loop, GC and aggregate HTTP metrics', () => {
    const metrics = new ObservabilityMetrics();
    metrics.startHttp();
    metrics.finishHttp('POST', '/orders', 422, 20, false);
    metrics.startHttp();
    metrics.finishHttp('GET', '/orders/:id', 503, 40, true);
    const snapshot = metrics.snapshot();
    expect(snapshot.http.totals).toMatchObject({
      completed: 2,
      aborted: 1,
      clientErrors: 1,
      serverErrors: 1,
    });
    expect(snapshot.http.totals.requestsPerSecond).toBeGreaterThanOrEqual(0);
    for (const value of Object.values(snapshot.process.eventLoopDelayMs)) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(snapshot.process.gc.count).toBe(0);
    metrics.onModuleDestroy();
  });

  it('accepts only fixed worker/outcome labels and returns independent snapshots', () => {
    const metrics = new ObservabilityMetrics();
    metrics.recordCacheLookup('feedPosts', 'hits');
    metrics.recordCacheLookup('private-key' as 'other', 'hits');
    metrics.recordCacheLookup('constructor' as 'other', 'misses');
    metrics.recordCacheLookup('other', 'secret-result' as 'hits');
    metrics.recordWorkerRun('push', 'ok');
    metrics.recordPushOutcome('token-invalid');
    metrics.recordFirebaseResult('error');
    metrics.recordWorkerRun('user-private' as 'push', 'ok');
    metrics.recordPushOutcome('token-private' as 'sent');
    const snapshot = metrics.snapshot();
    snapshot.push.sent = 9;
    expect(metrics.snapshot().push.sent).toBe(0);
    expect(snapshot.workers.push.runs).toBe(1);
    expect(snapshot.push['token-invalid']).toBe(1);
    expect(snapshot.redis.cacheLookups.feedPosts.hits).toBe(1);
    expect(snapshot.redis.cacheLookups.other).toEqual({
      hits: 0,
      misses: 0,
      errors: 0,
    });
    expect(JSON.stringify(snapshot)).not.toMatch(
      /user-private|token-private|private-key|secret-result/,
    );
    metrics.recordFirebaseResult('ok');
    expect(metrics.snapshot().firebase.failingSince).toBeNull();
  });

  it('counts client disconnects separately from response errors', () => {
    const metrics = new ObservabilityMetrics();
    metrics.startSse('GET', '/events', false).finish(10, true);
    metrics.startSse('GET', '/events', false).finish(20, false);
    expect(metrics.snapshot().http.routes[0].sse).toMatchObject({
      opened: 2,
      active: 0,
      aborted: 1,
      errors: 0,
      duration: { count: 2 },
    });
  });

  it('validates each event label at runtime without retaining arbitrary labels', () => {
    const metrics = new ObservabilityMetrics();
    metrics.recordEvent('push', 'sent');
    metrics.recordEvent('push', 'delivery-error');
    metrics.recordEvent('rematch', 'accepted');
    metrics.recordEvent('ai.intent', 'PROVIDER_SEARCH');
    metrics.recordEvent('ai.cta', 'offered');
    metrics.recordEvent('ai.booking' as 'rematch', 'created' as 'accepted');
    metrics.recordEvent('rematch', 'private-id' as 'accepted');
    metrics.recordEvent('private-prompt' as 'rematch', 'accepted');
    metrics.recordEvent('toString' as 'rematch', 'accepted');
    const snapshot = metrics.snapshot();
    expect(snapshot.push.sent).toBe(1);
    expect(snapshot.events.push['delivery-error']).toBe(1);
    expect(snapshot.events.rematch.accepted).toBe(1);
    expect(snapshot.events['ai.intent'].PROVIDER_SEARCH).toBe(1);
    expect(snapshot.events['ai.cta'].offered).toBe(1);
    expect(snapshot.events).not.toHaveProperty('ai.booking');
    expect(JSON.stringify(snapshot)).not.toMatch(/private-id|private-prompt/);
  });
});
