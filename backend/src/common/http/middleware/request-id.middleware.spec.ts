import type { NextFunction, Response } from 'express';
import type { RequestWithId } from '../types/request-with-id.type';
import { requestIdMiddleware } from './request-id.middleware';
import {
  allowsPublicReadFallback,
  currentRequestId,
  runWithRequestId,
} from '../request-context';

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

  it('keeps concurrent async chains isolated and restores the outside context', async () => {
    const executeAsync = (id: string, delay: number) =>
      new Promise<string | undefined>((resolve) => {
        const request = { get: () => id } as unknown as RequestWithId;
        const response = { setHeader: jest.fn() } as unknown as Response;
        requestIdMiddleware(request, response, () => {
          expect(currentRequestId()).toBe(id);
          setTimeout(() => resolve(currentRequestId()), delay);
        });
      });
    await expect(
      Promise.all([executeAsync('first', 15), executeAsync('second', 0)]),
    ).resolves.toEqual(['first', 'second']);
    expect(currentRequestId()).toBeUndefined();
  });

  it('bounds worker contexts and restores a parent context after throwing', () => {
    runWithRequestId('parent', () => {
      expect(() =>
        runWithRequestId('token\nprivate', () => {
          expect(currentRequestId()).toMatch(/^[0-9a-f-]{36}$/);
          throw new Error('failure');
        }),
      ).toThrow('failure');
      expect(currentRequestId()).toBe('parent');
    });
    expect(currentRequestId()).toBeUndefined();
  });

  it.each([
    ['GET', '/api/feed/posts', true],
    ['GET', '/api/me/feed/posts', true],
    ['GET', '/api/categories', true],
    ['GET', '/api/categories/hair-care', true],
    ['GET', '/api/services', true],
    ['GET', '/api/services/hair-care', true],
    ['POST', '/api/categories', false],
    ['POST', '/api/services', false],
    ['GET', '/api/services/hair-care/booking', false],
    ['GET', '/api/admin/services', false],
    ['GET', '/api/me/feed/mine', false],
    ['GET', '/api/internal/feed/cache/status', false],
    ['POST', '/api/me/feed/posts', false],
    ['DELETE', '/api/me/feed/posts/123', false],
    ['GET', '/api/admin/orders', false],
  ])('limits degradation to public reads: %s %s', (method, path, allowed) => {
    const request = {
      get: () => 'id',
      method,
      path,
    } as unknown as RequestWithId;
    requestIdMiddleware(
      request,
      { setHeader: jest.fn() } as unknown as Response,
      () => {
        expect(allowsPublicReadFallback()).toBe(allowed);
      },
    );
    expect(allowsPublicReadFallback()).toBe(false);
  });
});
