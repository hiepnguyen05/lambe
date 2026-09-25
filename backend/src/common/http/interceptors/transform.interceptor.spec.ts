import type { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  const context = {
    switchToHttp: () => ({
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;

  const run = (value: unknown) =>
    lastValueFrom(
      new TransformInterceptor().intercept(context, {
        handle: () => of(value),
      }),
    );

  it('wraps a raw controller result', async () => {
    await expect(run({ status: 'ok' })).resolves.toMatchObject({
      statusCode: 200,
      success: true,
      data: { status: 'ok' },
    });
  });

  it('moves legacy top-level response fields into data without losing them', async () => {
    await expect(
      run({
        success: true,
        message: 'Verified',
        isNewUser: true,
        data: { registrationToken: 'token' },
      }),
    ).resolves.toMatchObject({
      success: true,
      message: 'Verified',
      data: { isNewUser: true, registrationToken: 'token' },
    });
  });

  it('wraps an empty response as null data', async () => {
    await expect(run(undefined)).resolves.toMatchObject({
      success: true,
      data: null,
    });
  });
});
