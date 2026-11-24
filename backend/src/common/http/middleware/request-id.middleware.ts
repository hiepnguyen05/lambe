import type { NextFunction, Response } from 'express';
import { boundedRequestId, runWithRequestId } from '../request-context';
import type { RequestWithId } from '../types/request-with-id.type';

export function requestIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  const requestId = boundedRequestId(request.get('x-request-id'));

  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  // Only public Feed reads may degrade to a conservative per-replica limiter.
  // Writes and management/auth/payment endpoints retain shared fail-closed protection.
  const publicFeedRead =
    request.method === 'GET' &&
    /^\/api\/(?:feed\/posts(?:\/[a-f0-9-]{36}(?:\/comments(?:\/[a-f0-9-]{36}\/replies)?)?)?|me\/feed\/posts(?:\/[a-f0-9-]{36})?)\/?$/i.test(
      request.path,
    );
  runWithRequestId(requestId, next, publicFeedRead);
}
