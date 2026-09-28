import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProviderEmailVerificationService } from './provider-email-verification.service';

function context() {
  const application = {
    id: 'application',
    userId: 'owner',
    email: 'test@example.com',
    emailVerifiedAt: null,
    status: 'DRAFT',
  };
  const verification = {
    applicationId: 'application',
    email: application.email,
    nonce: 'nonce',
    codeHash: Buffer.alloc(32, 1).toString('hex'),
    attempts: 0,
    expiresAt: new Date(Date.now() + 600_000),
    requestedAt: new Date(Date.now() - 120_000),
  };
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: application.id }]),
    providerApplication: {
      findFirst: jest.fn().mockResolvedValue(application),
      update: jest.fn(),
    },
    providerApplicationEmailVerification: {
      findUnique: jest.fn().mockResolvedValue(verification),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    mailOutbox: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const crypto = {
    hashEmailVerification: jest.fn().mockReturnValue(verification.codeHash),
  };
  const outbox = { enqueue: jest.fn() };
  const mail = { isEnabled: jest.fn().mockReturnValue(true) };
  return {
    service: new ProviderEmailVerificationService(
      prisma as never,
      crypto as never,
      outbox as never,
      mail as never,
    ),
    transaction,
    verification,
    crypto,
    outbox,
    mail,
    application,
  };
}

describe('Provider email verification', () => {
  it('queues a code with an expiry without returning it to the client', async () => {
    const { service, outbox, transaction } = context();
    const result = await service.requestCode('application', 'owner');
    expect(result).not.toHaveProperty('code');
    expect(
      transaction.providerApplicationEmailVerification.upsert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          attempts: 0,
          codeHash: expect.any(String) as unknown,
        }) as unknown,
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com' }),
      expect.stringContaining('provider-email:application:'),
      transaction,
      expect.any(Date),
    );
  });
  it('does not queue mail when SMTP is disabled', async () => {
    const { service, mail, outbox } = context();
    mail.isEnabled.mockReturnValue(false);
    await expect(
      service.requestCode('application', 'owner'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
  it('enforces resend cooldown even if requests come from different IPs', async () => {
    const { service, verification, outbox } = context();
    verification.requestedAt = new Date();
    await expect(
      service.requestCode('application', 'owner'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
  it('commits failed attempts and does not verify the email', async () => {
    const { service, crypto, transaction } = context();
    crypto.hashEmailVerification.mockReturnValue(
      Buffer.alloc(32, 2).toString('hex'),
    );
    await expect(
      service.confirmCode('application', 'owner', '000000'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      transaction.providerApplicationEmailVerification.update,
    ).toHaveBeenCalledWith({
      where: { applicationId: 'application' },
      data: { attempts: { increment: 1 } },
    });
    expect(transaction.providerApplication.update).not.toHaveBeenCalled();
  });
  it.each(['expired', 'exhausted', 'changed-email'])(
    'rejects %s codes',
    async (reason) => {
      const { service, verification, transaction } = context();
      if (reason === 'expired')
        verification.expiresAt = new Date(Date.now() - 1);
      if (reason === 'exhausted') verification.attempts = 5;
      if (reason === 'changed-email') verification.email = 'other@example.com';
      await expect(
        service.confirmCode('application', 'owner', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction.providerApplication.update).not.toHaveBeenCalled();
    },
  );
  it('verifies the email and consumes the proof only once', async () => {
    const { service, transaction } = context();
    await expect(
      service.confirmCode('application', 'owner', '123456'),
    ).resolves.toHaveProperty('success', true);
    expect(transaction.providerApplication.update).toHaveBeenCalledWith({
      where: { id: 'application' },
      data: { emailVerifiedAt: expect.any(Date) as unknown },
    });
    expect(
      transaction.providerApplicationEmailVerification.delete,
    ).toHaveBeenCalledWith({ where: { applicationId: 'application' } });
  });
  it('rechecks ownership inside the locked transaction', async () => {
    const { service, transaction, outbox } = context();
    transaction.$queryRaw.mockResolvedValue([]);
    await expect(
      service.requestCode('application', 'intruder'),
    ).rejects.toThrow();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
