import { developmentTargets } from '../../scripts/probe-development-cloud';

describe('development cloud probe preflight', () => {
  const postgres =
    'postgresql://dev:secret@ep-lambe-dev-pooler.c-5.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  const direct = postgres.replace('-pooler.', '.');
  const redis = 'rediss://default:secret@lambe-dev.upstash.io:6379';
  const config = (database = postgres, migration = direct, cache = redis) =>
    `DATABASE_URL="${database}"\nDIRECT_URL="${migration}"\nREDIS_URL="${cache}"`;

  it('reads the existing development targets without creating a client', () => {
    expect(developmentTargets(config())).toEqual({
      databaseUrl: postgres,
      redisUrl: redis,
    });
  });

  it.each([
    config(postgres.replace('neon.tech', 'example.com')),
    config(postgres.replace('sslmode=require', 'sslmode=disable')),
    config(postgres, postgres),
    config(postgres, direct.replace('neondb', 'other')),
    config(postgres, direct.replace('postgresql:', 'http:')),
    config(postgres, direct.replace('dev:secret', 'dev:wrong')),
    config(postgres, direct, redis.replace('rediss:', 'redis:')),
    config(postgres, direct, redis.replace('upstash.io', 'example.com')),
    config(postgres, direct, redis.replace('default:secret', 'default:')),
  ])('rejects an unexpected development target without connecting', (text) => {
    expect(() => developmentTargets(text)).toThrow(
      'Invalid development Neon/Upstash targets.',
    );
  });
});
