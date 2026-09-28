import { MailOutboxService } from './mail-outbox.service';

function context(enabled = true) {
  const message = {
    id: 'mail',
    recipient: 'test@example.com',
    subject: 'Test',
    text: 'body',
    html: 'body',
    attempts: 1,
    lockedUntil: new Date(Date.now() + 120_000),
  };
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValueOnce([message]).mockResolvedValue([]),
    mailOutbox: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn(),
    },
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
  it('marks successful deliveries and removes email body from storage', async () => {
    const { service, prisma, mail } = context();
    await service.deliverPending();
    expect(mail.send).toHaveBeenCalledTimes(1);
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
    mail.send.mockRejectedValue(new Error('credential secret'));
    await service.deliverPending();
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
    expect(prisma.mailOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedAt: expect.any(Date) as unknown,
        }) as unknown,
      }),
    );
  });
  it('prevents overlapping local workers', async () => {
    const { service, prisma } = context();
    await Promise.all([service.deliverPending(), service.deliverPending()]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
