import { MailOutboxService } from './mail-outbox.service';
import { Logger } from '@nestjs/common';

function context(enabled = true) {
  const message = {
    id: 'mail',
    recipient: 'test@example.com',
    subject: 'Test',
    text: 'body',
    html: 'body',
    attempts: 1,
    deduplicationKey: 'ordinary-mail',
    lockedUntil: new Date(Date.now() + 120_000),
  };
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValueOnce([message]).mockResolvedValue([]),
    mailOutbox: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn(),
    },
    internalAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    feedNotice: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const mail = {
    isEnabled: jest.fn().mockReturnValue(enabled),
    send: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new MailOutboxService(prisma as never, mail as never),
    prisma,
    mail,
    message,
  };
}

describe('Mail outbox', () => {
  let log: jest.SpyInstance, warn: jest.SpyInstance, error: jest.SpyInstance;
  beforeEach(() => {
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
  it('enqueues once in the supplied business transaction', async () => {
    const { service, prisma } = context();
    await service.enqueue(
      { to: 'test@example.com', subject: 'Test', text: 'body', html: 'body' },
      'event-key',
      prisma as never,
    );
    expect(prisma.mailOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deduplicationKey: 'event-key' },
        update: {},
      }),
    );
  });
  it('leaves pending mail untouched when SMTP is disabled', async () => {
    const { service, prisma, mail } = context(false);
    await service.deliverPending();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });
  it('does not send Feed mail after the owner/contact is no longer eligible', async () => {
    const { service, mail, message } = context();
    message.deduplicationKey = 'feed-notice:expired-notice';
    await service.deliverPending();
    expect(mail.send).not.toHaveBeenCalled();
  });
  it('marks successful deliveries and removes email body from storage', async () => {
    const { service, prisma, mail } = context();
    await service.deliverPending();
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(log.mock.calls).toEqual([
      ['mail.outbox.delivering'],
      ['mail.outbox.delivered'],
    ]);
    expect(prisma.mailOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'mail', attempts: 1 }) as unknown,
        data: {
          sentAt: expect.any(Date) as unknown,
          lockedUntil: null,
          text: '',
          html: '',
        },
      }),
    );
  });
  it('schedules a retry without leaking the SMTP error', async () => {
    const { service, prisma, mail } = context();
    mail.send.mockRejectedValue(
      Object.assign(new Error('credential secret test@example.com'), {
        code: 'ECONNECTION',
        responseCode: 421,
        command: 'AUTH credential secret',
        response: 'private SMTP response',
        stack: 'private-stack-sentinel',
      }),
    );
    await service.deliverPending();
    expect(warn.mock.calls).toEqual([
      [
        {
          event: 'mail.outbox.retry_scheduled',
          code: 'ECONNECTION',
          responseCode: 421,
        },
      ],
    ]);
    expect(log.mock.calls).toEqual([['mail.outbox.delivering']]);
    expect(prisma.mailOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          lockedUntil: null,
          failedAt: null,
          availableAt: expect.any(Date) as unknown,
        },
      }),
    );
  });
  it('stops after eight attempts', async () => {
    const { service, prisma, mail, message } = context();
    prisma.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ ...message, attempts: 8 }])
      .mockResolvedValue([]);
    mail.send.mockRejectedValue(new Error('SMTP down'));
    await service.deliverPending();
    expect(warn.mock.calls).toEqual([
      [{ event: 'mail.outbox.delivery_exhausted' }],
    ]);
    expect(prisma.mailOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedAt: expect.any(Date) as unknown,
        }) as unknown,
      }),
    );
  });
  it.each([
    'order-alert:alert-id:initial:staff-id',
    'feed-cache-alert:hour:staff-id',
  ])(
    'drops an internal alert email after staff access is revoked: %s',
    async (deduplicationKey) => {
      const { service, prisma, mail, message } = context();
      prisma.$queryRaw
        .mockReset()
        .mockResolvedValueOnce([
          {
            ...message,
            deduplicationKey,
          },
        ])
        .mockResolvedValue([]);

      await service.deliverPending();

      const [accessQuery] = prisma.internalAccount.findFirst.mock
        .calls[0] as unknown as [
        { where: { id: string; email: string; status: string } },
      ];
      expect(accessQuery.where).toMatchObject({
        id: 'staff-id',
        email: message.recipient,
        status: 'ACTIVE',
      });
      expect(mail.send).not.toHaveBeenCalled();
      const lastUpdate = prisma.mailOutbox.updateMany.mock.calls.at(
        -1,
      ) as unknown as [
        { data: { failedAt: Date; text: string; html: string } },
      ];
      expect(lastUpdate[0].data).toMatchObject({ text: '', html: '' });
      expect(lastUpdate[0].data.failedAt).toBeInstanceOf(Date);
    },
  );
  it('prevents overlapping local workers', async () => {
    const { service, prisma } = context();
    await Promise.all([service.deliverPending(), service.deliverPending()]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('never logs a manual source or untrusted processing error fields', async () => {
    const disabled = context(false);
    await disabled.service.deliverPending(
      'private-subject-sentinel recipient@example.test',
    );
    expect(warn.mock.calls).toEqual([['mail.outbox.skipped_disabled']]);
    const { service, prisma } = context();
    prisma.$queryRaw.mockReset().mockRejectedValue({
      message: 'credential-sentinel',
      code: 'recipient@example.test',
      responseCode: '550 private SMTP message',
      command: 'AUTH credential-sentinel',
      stack: 'private-stack-sentinel',
    });
    await service.deliverPending('private-source-sentinel');
    expect(error.mock.calls).toEqual([
      [{ event: 'mail.outbox.processing_failed' }],
    ]);
    expect(log).not.toHaveBeenCalled();
  });
});
