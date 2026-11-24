import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProviderRealtimeLocationDto } from './provider-location.dto';

describe('ProviderRealtimeLocationDto', () => {
  const capturedAt = '2026-11-05T05:30:00.000Z';
  const valid = {
    latitude: 21.0285,
    longitude: 105.8542,
    accuracyMeters: 12,
    capturedAt,
    sequence: Date.parse(capturedAt),
  };

  it('accepts a complete ordered GPS observation', async () => {
    expect(
      await validate(plainToInstance(ProviderRealtimeLocationDto, valid)),
    ).toHaveLength(0);
  });

  it.each([
    ['accuracyMeters', 101],
    ['capturedAt', 'yesterday'],
    ['sequence', -1],
    ['sequence', 1.5],
  ])('rejects invalid %s metadata', async (field, value) => {
    const errors = await validate(
      plainToInstance(ProviderRealtimeLocationDto, {
        ...valid,
        [field]: value,
      }),
    );
    expect(errors.map((error) => error.property)).toContain(field);
  });
});
