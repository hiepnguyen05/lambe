import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { streamNotifications } from './stream-notifications';

function responseFixture() {
  const events = new EventEmitter();
  const write = jest.fn();
  const response = Object.assign(events, {
    destroyed: false,
    writableEnded: false,
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write,
    end: jest.fn(() => events.emit('close')),
  });
  return { events, write, response: response as unknown as Response };
}

describe('notification stream connection lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('releases a subscription established after the client already disconnected', async () => {
    const { events, response } = responseFixture();
    const stop = jest.fn().mockResolvedValue(undefined);
    const read = jest.fn().mockResolvedValue([]);
    await streamNotifications(response, undefined, read, () => {
      events.emit('close');
      return Promise.resolve(stop);
    });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not write or start timers after disconnection during the first database read', async () => {
    const { events, response, write } = responseFixture();
    const stop = jest.fn().mockResolvedValue(undefined);
    await streamNotifications(
      response,
      undefined,
      () => {
        events.emit('close');
        return Promise.resolve([{ id: 'notice' }]);
      },
      () => Promise.resolve(stop),
    );
    expect(stop).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cleans up when the initial permission or cursor check fails', async () => {
    const { response } = responseFixture();
    const stop = jest.fn().mockResolvedValue(undefined);
    await expect(
      streamNotifications(
        response,
        undefined,
        () => Promise.reject(new Error('forbidden')),
        () => Promise.resolve(stop),
      ),
    ).rejects.toThrow('forbidden');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('polls PostgreSQL without Redis and releases timers when the connection closes', async () => {
    const { events, response } = responseFixture();
    const read = jest.fn().mockResolvedValue([]);
    await streamNotifications(response, undefined, read, () =>
      Promise.reject(new Error('redis unavailable')),
    );
    await jest.advanceTimersByTimeAsync(10_000);
    expect(read).toHaveBeenCalledTimes(2);
    events.emit('close');
    expect(jest.getTimerCount()).toBe(0);
  });
});
