import { InternalServerErrorException } from '@nestjs/common';
import { SpeedSmsService } from './speedsms.service';

describe('SpeedSmsService', () => {
  const createService = (
    values: Record<string, string | number | undefined>,
  ) => {
    const configService = {
      get: jest.fn((key: string) => values[key]),
    };

    return new SpeedSmsService(configService as never);
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('uses an explicit development fallback when the token is missing', async () => {
    const service = createService({ 'app.nodeEnv': 'development' });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      service.sendOtp('0363668951', '123456'),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses to simulate OTP delivery in production', async () => {
    const service = createService({ 'app.nodeEnv': 'production' });

    await expect(
      service.sendOtp('0363668951', '123456'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('sends OTP with Basic authentication and the default Notify type', async () => {
    const service = createService({
      'app.nodeEnv': 'development',
      'speedsms.accessToken': 'speed-token',
      'speedsms.apiUrl': 'https://api.speedsms.vn/index.php/',
      'speedsms.smsType': 4,
      'speedsms.sender': '',
      'speedsms.timeoutMs': 10000,
    });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          code: '00',
          data: {
            tranId: 123456,
            totalSMS: 1,
            totalPrice: 500,
            invalidPhone: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await service.sendOtp('+84363668951', '123456');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    const headers = new Headers(options?.headers);
    expect(url).toBe('https://api.speedsms.vn/index.php/sms/send');
    expect(options?.method).toBe('POST');
    expect(headers.get('Authorization')).toBe(
      `Basic ${Buffer.from('speed-token:x').toString('base64')}`,
    );
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(options?.body).toBe(
      JSON.stringify({
        to: ['0363668951'],
        content: 'Ma OTP Lambe cua ban la 123456. Ma co hieu luc trong 5 phut.',
        sms_type: 4,
        sender: '',
      }),
    );
  });

  it('maps a provider error to a safe server error', async () => {
    const service = createService({
      'app.nodeEnv': 'development',
      'speedsms.accessToken': 'speed-token',
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'error',
          code: '300',
          message: 'Balance is not enough',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      service.sendOtp('0363668951', '123456'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('maps a non-successful HTTP response to a safe server error', async () => {
    const service = createService({
      'speedsms.accessToken': 'speed-token',
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(null, { status: 503, statusText: 'Down' }),
      );

    await expect(
      service.sendOtp('0363668951', '123456'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejects a successful provider response that lists the phone as invalid', async () => {
    const service = createService({
      'speedsms.accessToken': 'speed-token',
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          code: '00',
          data: {
            tranId: 123,
            totalSMS: 0,
            totalPrice: 0,
            invalidPhone: ['+84363668951'],
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.sendOtp('0363668951', '123456'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejects a provider response without a transaction id', async () => {
    const service = createService({
      'speedsms.accessToken': 'speed-token',
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          code: '00',
          data: { tranId: '', totalSMS: 1, totalPrice: 500 },
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.sendOtp('0363668951', '123456'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('preserves an HttpException raised by the HTTP layer', async () => {
    const service = createService({
      'speedsms.accessToken': 'speed-token',
    });
    const providerException = new InternalServerErrorException('upstream');
    jest.spyOn(global, 'fetch').mockRejectedValue(providerException);

    await expect(service.sendOtp('0363668951', '123456')).rejects.toBe(
      providerException,
    );
  });

  it('aborts a request that exceeds the configured timeout', async () => {
    jest.useFakeTimers();
    const service = createService({
      'app.nodeEnv': 'development',
      'speedsms.accessToken': 'speed-token',
      'speedsms.timeoutMs': 50,
    });
    jest.spyOn(global, 'fetch').mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const expectation = expect(
      service.sendOtp('0363668951', '123456'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    await jest.advanceTimersByTimeAsync(50);

    await expectation;
  });
});
