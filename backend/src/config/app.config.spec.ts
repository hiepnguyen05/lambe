import appConfig from './app.config';

describe('appConfig', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('uses safe local defaults', () => {
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.CORS_ORIGIN;
    delete process.env.TRUST_PROXY;

    expect(appConfig()).toEqual({
      nodeEnv: 'development',
      port: 5000,
      corsOrigin: '',
      trustProxy: false,
    });
  });

  it('parses proxy hop counts and named trusted ranges', () => {
    process.env.TRUST_PROXY = '2';
    expect(appConfig().trustProxy).toBe(2);

    process.env.TRUST_PROXY = 'loopback';
    expect(appConfig().trustProxy).toBe('loopback');
  });
});
