import { RedisCacheService } from './redis-cache.service';

describe('RedisCacheService', () => {
  const createDisabledService = () => {
    const configService = {
      get: jest.fn((key: string, defaultValue: unknown) =>
        key === 'cache.enabled' ? false : defaultValue,
      ),
    };

    return new RedisCacheService(configService as never);
  };

  it('acts as a no-op cache when Redis is disabled', async () => {
    const service = createDisabledService();

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.get('missing')).resolves.toBeNull();
    await expect(service.set('key', { value: true })).resolves.toBeUndefined();
    await expect(service.delete('key')).resolves.toBeUndefined();
    expect(service.getStatus()).toBe('disabled');
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
