import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { currentRequestId } from '../../common/http/request-context';
import {
  boundedHttpRoute,
  ObservabilityMetrics,
} from './observability-metrics.service';

@Injectable()
export class ObservabilityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ObservabilityMiddleware.name);

  constructor(private readonly metrics: ObservabilityMetrics) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const started = performance.now();
    const requestId = currentRequestId();
    this.metrics.startHttp();
    let finished = false;
    let sse: ReturnType<ObservabilityMetrics['startSse']> | undefined;
    let sseStarted = 0;
    const middlewareRoute: unknown = request.route;
    const template = (): unknown =>
      request.route === middlewareRoute
        ? undefined
        : (request.route as { path?: unknown } | undefined)?.path;
    const detectSse = (headers: unknown) => {
      if (sse || finished || response.statusCode >= 400) return;
      // Nest passes SSE headers directly to writeHead. Node may not retain
      // them in getHeader when no headers were previously set.
      const contentType: unknown =
        (headers && typeof headers === 'object'
          ? Object.entries(headers).find(
              ([name]) => name.toLowerCase() === 'content-type',
            )?.[1]
          : undefined) ?? response.getHeader('content-type');
      if (
        typeof contentType !== 'string' ||
        !/^text\/event-stream(?:;|$)/i.test(contentType)
      )
        return;
      sseStarted = performance.now();
      // Presence only: never keep or return a cursor/header/query value.
      const resumed =
        request.headers['last-event-id'] !== undefined ||
        Object.prototype.hasOwnProperty.call(request.query, 'after') ||
        Object.prototype.hasOwnProperty.call(request.query, 'afterSequence');
      sse = this.metrics.startSse(request.method, template(), resumed);
      response.write = new Proxy(originalWrite, {
        apply(target, receiver: Response, args: unknown[]) {
          const result = Reflect.apply(target, receiver, args) as boolean;
          const chunk = args[0];
          // Nest opens the stream with a lone newline before the first frame.
          if (
            chunk !== '\n' &&
            !(Buffer.isBuffer(chunk) && chunk.length === 1 && chunk[0] === 10)
          ) {
            sse?.message();
          }
          return result;
        },
      });
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Proxy forwards the receiver; cleanup restores the original method.
    const originalWriteHead = response.writeHead;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Proxy forwards the receiver; cleanup restores the original method.
    const originalWrite = response.write;
    response.writeHead = new Proxy(originalWriteHead, {
      apply(target, receiver: Response, args: unknown[]) {
        const result: unknown = Reflect.apply(target, receiver, args);
        detectSse(typeof args[1] === 'string' ? args[2] : args[1]);
        return result;
      },
    });
    const onError = () => sse?.error();
    const finish = () => {
      if (finished) return;
      finished = true;
      const aborted = !response.writableFinished;
      const durationMs = performance.now() - started;
      const route = boundedHttpRoute(request.method, template());
      sse?.finish(performance.now() - sseStarted, aborted);
      this.metrics.finishHttp(
        request.method,
        template(),
        response.statusCode,
        durationMs,
        aborted,
      );
      const logRecord = {
        event: 'http.request.completed',
        requestId,
        method: route.verb,
        route: route.path,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(3)),
        aborted,
      };
      if (aborted || response.statusCode >= 500) this.logger.warn(logRecord);
      else if (Math.random() < 0.01) this.logger.log(logRecord);
      response.off('finish', finish);
      response.off('close', finish);
      response.off('error', onError);
      response.writeHead = originalWriteHead;
      if (sse) response.write = originalWrite;
    };
    response.once('finish', finish);
    response.once('close', finish);
    response.on('error', onError);
    next();
  }
}
