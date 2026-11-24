import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrderLocationDto } from './order-location.dto';

describe('OrderLocationDto', () => {
  const valid = {
    latitude: 21.0285,
    longitude: 105.8542,
    accuracyMeters: 12,
    capturedAt: '2026-10-20T06:00:00.000Z',
  };

  it('accepts a valid GPS observation', async () => {
    expect(
      await validate(plainToInstance(OrderLocationDto, valid)),
    ).toHaveLength(0);
  });

  it('rejects invalid coordinates', async () => {
    const errors = await validate(
      plainToInstance(OrderLocationDto, {
        ...valid,
        latitude: 91,
        longitude: 181,
      }),
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['latitude', 'longitude']),
    );
  });

  it('rejects GPS accuracy worse than 100 meters', async () => {
    const errors = await validate(
      plainToInstance(OrderLocationDto, {
        ...valid,
        accuracyMeters: 101,
      }),
    );
    expect(errors.map((error) => error.property)).toContain('accuracyMeters');
  });

  it('rejects a malformed capture timestamp', async () => {
    const errors = await validate(
      plainToInstance(OrderLocationDto, {
        ...valid,
        capturedAt: 'yesterday',
      }),
    );
    expect(errors.map((error) => error.property)).toContain('capturedAt');
  });
});
