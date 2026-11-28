import { raceWithTimeout } from './race-with-timeout';

describe('raceWithTimeout', () => {
  afterEach(() => jest.useRealTimers());

  it('returns the operation result before the deadline', async () => {
    await expect(
      raceWithTimeout(Promise.resolve('done'), 100, () => 'fallback'),
    ).resolves.toBe('done');
  });

  it('uses the timeout result after the deadline', async () => {
    jest.useFakeTimers();
    const result = raceWithTimeout(
      new Promise<string>(() => undefined),
      100,
      () => 'fallback',
    );
    await jest.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe('fallback');
  });

  it('propagates a timeout error', async () => {
    jest.useFakeTimers();
    const result = raceWithTimeout(
      new Promise<string>(() => undefined),
      100,
      () => {
        throw new Error('deadline');
      },
    );
    const assertion = expect(result).rejects.toThrow('deadline');
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
  });
});
