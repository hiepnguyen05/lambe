import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import { runWithRequestId } from '../../common/http/request-context';
import { ObservabilityMetrics } from './observability-metrics.service';
import { ObservabilityMiddleware } from './observability.middleware';

describe('ObservabilityMiddleware', () => {
  afterEach(() => jest.restoreAllMocks());

  it('detects SSE headers passed directly by Nest and counts only frames', () => {
    const metrics = new ObservabilityMetrics();
    const middleware = new ObservabilityMiddleware(metrics);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const request = {
      method: 'GET',
      route: { path: '{*path}' },
      originalUrl: '/orders/private-id/events?after=private-cursor',
      headers: { authorization: 'Bearer private-token' },
      query: { after: 'private-cursor' },
    };
    const write = jest.fn<boolean, [string | Buffer]>().mockReturnValue(true);
    const response = Object.assign(new EventEmitter(), {
      write,
      writeHead: jest.fn<undefined, [number, object]>(),
      getHeader: jest.fn(() => undefined),
      statusCode: 200,
      writableFinished: false,
    });

    runWithRequestId('req-123', () => {
      middleware.use(
        request as unknown as Request,
        response as unknown as Response,
        () => {
          request.route = { path: '/orders/:id/events' };
          response.writeHead(200, { 'Content-Type': 'text/event-stream' });
          response.write('\n');
          response.write(Buffer.from('data: private-data\n\n'));
        },
      );
    });

    response.emit('close');
    response.emit('finish');

    expect(response.write).toBe(write);
    expect(metrics.snapshot().http.routes).toEqual([
      expect.objectContaining({
        route: 'GET /orders/:id/events',
        completed: 1,
        sse: {
          opened: 1,
          active: 0,
          aborted: 1,
          resumeSignals: 1,
          messages: 1,
          errors: 0,
          duration: expect.objectContaining({ count: 1 }) as unknown,
        },
      }),
    ]);
    expect(warn.mock.calls).toEqual([
      [
        {
          event: 'http.request.completed',
          requestId: 'req-123',
          method: 'GET',
          route: '/orders/:id/events',
          statusCode: 200,
          durationMs: expect.any(Number) as unknown,
          aborted: true,
        },
      ],
    ]);
  });
});
