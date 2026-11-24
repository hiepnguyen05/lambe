import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

describe('MailService log privacy', () => {
  const verify = jest.fn(),
    sendMail = jest.fn();
  const input = {
    to: 'recipient-sentinel@example.test',
    subject: 'private-subject-sentinel',
    text: 'private-body-sentinel',
    html: '<b>private-body-sentinel</b>',
  };
  let log: jest.SpyInstance, warn: jest.SpyInstance, error: jest.SpyInstance;

  const createService = (enabled = true) =>
    new MailService(
      new ConfigService({
        mail: {
          enabled,
          user: 'sender-sentinel@example.test',
          appPassword: 'credential-sentinel',
          host: 'smtp.example.test',
          port: 465,
          secure: true,
        },
      }),
    );

  beforeEach(() => {
    jest.clearAllMocks();
    verify.mockReset().mockResolvedValue(undefined);
    sendMail.mockReset().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      verify,
      sendMail,
    });
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps verification and disabled-delivery logs free of sender, recipient and subject', async () => {
    const enabled = createService();
    await enabled.onModuleInit();
    await enabled.send(input);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining(input));
    expect(log.mock.calls).toEqual([['mail.smtp.verified']]);
    const disabled = createService(false);
    await disabled.onModuleInit();
    await disabled.send(input);
    expect(warn.mock.calls).toEqual([
      ['mail.delivery.disabled'],
      ['mail.delivery.skipped_disabled'],
    ]);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('retains only an allowlisted SMTP code and integer response code on verification failure', async () => {
    verify.mockRejectedValue(
      Object.assign(
        new Error('raw-SMTP-message recipient-sentinel@example.test'),
        {
          code: 'EAUTH',
          responseCode: 535,
          command: 'AUTH credential-sentinel',
          response: 'private-subject-sentinel',
          stack: 'private-stack-sentinel',
        },
      ),
    );
    await expect(createService().onModuleInit()).resolves.toBeUndefined();
    expect(error.mock.calls).toEqual([
      [{ event: 'mail.smtp.verify_failed', code: 'EAUTH', responseCode: 535 }],
    ]);
  });

  it.each([
    {
      code: 'recipient-sentinel@example.test',
      responseCode: '535 private-subject-sentinel',
    },
    { code: 'EAUTH credential-sentinel', responseCode: 535.5 },
    { code: 'private-subject-sentinel', responseCode: Infinity },
    { code: 'private-stack-sentinel', responseCode: 999 },
  ])('discards untrusted error metadata: %j', async (failure) => {
    verify.mockRejectedValue(failure);
    await createService().onModuleInit();
    expect(error.mock.calls).toEqual([[{ event: 'mail.smtp.verify_failed' }]]);
  });

  it('preserves send failure propagation without logging the input or exception', async () => {
    const failure = new Error('raw-SMTP-message credential-sentinel');
    sendMail.mockRejectedValue(failure);
    await expect(createService().send(input)).rejects.toBe(failure);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
