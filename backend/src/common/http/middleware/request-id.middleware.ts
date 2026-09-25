import { randomUUID } from 'crypto';
import type { NextFunction, Response } from 'express';
import type { RequestWithId } from '../types/request-with-id.type';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export function requestIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  const incomingRequestId = request.get('x-request-id');
  const requestId =
    incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}
