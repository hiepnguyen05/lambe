import { EventEmitter } from 'node:events';
import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ChatQueryService } from '../application/chat-query.service';
import { ChatEventsController } from './chat-events.controller';

describe('ChatEventsController', () => {
  const user = { userId: 'customer' } as AuthenticatedUser;
  const params = { id: 'chat-id' };

  function setup() {
    const response = Object.assign(new EventEmitter(), {
      destroyed: false,
      writableEnded: false,
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn().mockReturnValue(true),
      end: jest.fn(),
    });
    const queries = {
      assertAccess: jest.fn().mockResolvedValue(undefined),
      messages: jest
        .fn()
        .mockResolvedValue({ data: [], meta: { nextCursor: null } }),
    };
    let signal: () => void = () => undefined;
    const unsubscribe = jest.fn().mockResolvedValue(undefined);
    const cache = {
      subscribeChatUpdates: jest.fn().mockImplementation((_id, listener) => {
        signal = listener as () => void;
        return Promise.resolve(unsubscribe);
      }),
    };
    const controller = new ChatEventsController(
      queries as unknown as ChatQueryService,
      cache as unknown as RedisCacheService,
    );
    return {
      controller,
      queries,
      cache,
      response,
      unsubscribe,
      signal: () => signal(),
      close: () => response.emit('close'),
    };
  }

  it('rejects an outsider before subscribing or writing SSE headers', async () => {
    const { controller, queries, cache, response } = setup();
    queries.assertAccess.mockRejectedValue(new NotFoundException());
    await expect(
      controller.events(user, params, {}, response as unknown as Response),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(cache.subscribeChatUpdates).not.toHaveBeenCalled();
    expect(response.flushHeaders).not.toHaveBeenCalled();
  });

  it('subscribes before reading and resumes in sequence order', async () => {
    const { controller, queries, cache, response, close, signal, unsubscribe } =
      setup();
    const message = { id: 'message-6', sequence: 6 };
    queries.messages.mockResolvedValueOnce({
      data: [message],
      meta: { nextCursor: null },
    });
    await controller.events(
      user,
      params,
      { afterSequence: 5 },
      response as unknown as Response,
    );
    expect(cache.subscribeChatUpdates.mock.invocationCallOrder[0]).toBeLessThan(
      queries.messages.mock.invocationCallOrder[0],
    );
    expect(queries.messages).toHaveBeenCalledWith('customer', 'chat-id', {
      afterSequence: 5,
      limit: 100,
    });
    expect(response.write).toHaveBeenCalledWith(
      `id: 6\nevent: message\ndata: ${JSON.stringify(message)}\n\n`,
    );
    signal();
    await Promise.resolve();
    expect(queries.messages).toHaveBeenLastCalledWith('customer', 'chat-id', {
      afterSequence: 6,
      limit: 100,
    });
    close();
    await Promise.resolve();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('polls PostgreSQL when Redis is unavailable', async () => {
    jest.useFakeTimers();
    try {
      const { controller, queries, cache, response, close } = setup();
      cache.subscribeChatUpdates.mockRejectedValue(new Error('Redis offline'));
      queries.messages
        .mockResolvedValueOnce({ data: [], meta: { nextCursor: null } })
        .mockResolvedValueOnce({
          data: [{ id: 'message-1', sequence: 1 }],
          meta: { nextCursor: null },
        });
      await controller.events(
        user,
        params,
        {},
        response as unknown as Response,
      );
      await jest.advanceTimersByTimeAsync(5_000);
      expect(response.write).toHaveBeenCalledWith(
        expect.stringContaining('id: 1\nevent: message'),
      );
      close();
    } finally {
      jest.useRealTimers();
    }
  });

  it('ends a slow stream instead of buffering an unbounded backlog', async () => {
    const { controller, queries, response, close } = setup();
    response.write.mockReturnValue(false);
    queries.messages.mockResolvedValueOnce({
      data: [{ id: 'message-1', sequence: 1 }],
      meta: { nextCursor: null },
    });
    await controller.events(user, params, {}, response as unknown as Response);
    expect(response.end).toHaveBeenCalledTimes(1);
    close();
  });
});
