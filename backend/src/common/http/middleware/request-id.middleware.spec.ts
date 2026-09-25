import type { NextFunction, Response } from 'express';
import type { RequestWithId } from '../types/request-with-id.type';
import { requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  const execute = (incomingRequestId?: string) => {
    const request = {
      get: jest.fn().mockReturnValue(incomingRequestId),
    } as unknown as RequestWithId;
    const setHeader = jest.fn();
    const response = {
      setHeader,
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(request, response, next);
    return { request, setHeader, next };
  };

  it('keeps a valid request id supplied by the client', () => {
    const { request, setHeader, next } = execute('frontend-request-123');

    expect(request.requestId).toBe('frontend-request-123');
    expect(setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'frontend-request-123',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, '', 'contains spaces', 'x'.repeat(101)])(
    'generates a UUID for an invalid request id: %s',
    (requestId) => {
      const { request, setHeader } = execute(requestId);

      expect(request.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(setHeader).toHaveBeenCalledWith('x-request-id', request.requestId);
    },
  );
});
