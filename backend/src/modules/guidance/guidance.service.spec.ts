import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GuidanceTourParamDto, SaveGuidanceDto } from './guidance.dto';

describe('Guidance progress validation', () => {
  it('validates bounded versions, steps, status and known tours', async () => {
    expect(
      await validate(
        plainToInstance(SaveGuidanceDto, {
          version: 1,
          stepIndex: 2,
          status: 'COMPLETED',
        }),
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(SaveGuidanceDto, {
            version: 0,
            stepIndex: 21,
            status: 'READY',
          }),
        )
      ).length,
    ).toBe(3);
    expect(
      (
        await validate(
          plainToInstance(GuidanceTourParamDto, { tourId: 'arbitrary' }),
        )
      ).length,
    ).toBe(1);
  });
});
