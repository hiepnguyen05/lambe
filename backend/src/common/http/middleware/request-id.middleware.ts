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
  // Public catalogue and Feed reads can use a conservative per-replica limit.
  // Booking, writes, management, auth and payment remain fail-closed.
  const publicRead =
    request.method === 'GET' &&
    (/^\/api\/(?:categories|services)(?:\/[a-z0-9-]+)?\/?$/i.test(
      request.path,
    ) ||
      /^\/api\/(?:feed\/posts(?:\/[a-f0-9-]{36}(?:\/comments(?:\/[a-f0-9-]{36}\/replies)?)?)?|me\/feed\/posts(?:\/[a-f0-9-]{36})?)\/?$/i.test(
        request.path,
      ));
  runWithRequestId(requestId, next, publicRead);
}
