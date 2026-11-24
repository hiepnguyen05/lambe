import { UnauthorizedException } from '@nestjs/common';
import { InternalAccountSetupService } from './internal-account-setup.service';

function fixture() {
  const tx = {
    internalSetupToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    internalCredential: { upsert: jest.fn(), updateMany: jest.fn() },
    internalAccount: { updateMany: jest.fn() },
    internalSession: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    internalAccount: { findUnique: jest.fn() },
    internalSetupToken: { findUnique: jest.fn() },
  };
  const mail = { isEnabled: jest.fn().mockReturnValue(true) };
  const outbox = { enqueue: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new InternalAccountSetupService(
    prisma as never,
    mail as never,
    outbox as never,
    audit as never,
  );
  return { service, tx, prisma, mail, outbox, audit };
}

describe('InternalAccountSetupService', () => {
  it('stores only a token hash and enqueues an expiring email', async () => {
    const { service, tx, outbox } = fixture();
    tx.internalSetupToken.create.mockResolvedValue({ id: 'token-id' });
    await service.issue(
      { id: 'staff-id', email: 'staff@example.com', status: 'INVITED' },
      tx as never,
    );
    const createCalls = tx.internalSetupToken.create.mock
      .calls as unknown as Array<[{ data: { tokenHash: string } }]>;
    const enqueueCalls = outbox.enqueue.mock.calls as unknown as Array<
      [{ text: string }]
    >;
    const hashed = createCalls[0][0];
    const email = enqueueCalls[0][0];
    expect(hashed.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(email.text).not.toContain(hashed.data.tokenHash);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      'internal-setup:token-id',
      tx,
      expect.any(Date),
    );
  });

  it('rejects expired tokens before changing credentials', async () => {
    const { service, tx, prisma } = fixture();
    prisma.internalSetupToken.findUnique.mockResolvedValue({
      id: 'token-id',
      accountId: 'staff-id',
      account: { status: 'INVITED' },
      consumedAt: null,
      expiresAt: new Date(0),
    });
    await expect(
      service.activate('a'.repeat(64), 'A-strong-password-2026', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.internalCredential.upsert).not.toHaveBeenCalled();
  });

  it('consumes a valid token, sets password, and revokes old sessions', async () => {
    const { service, tx, audit, prisma } = fixture();
    const tokenRecord = {
      id: 'token-id',
      accountId: 'staff-id',
      account: { status: 'INVITED' },
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    prisma.internalSetupToken.findUnique.mockResolvedValue(tokenRecord);
    tx.internalSetupToken.findUnique.mockResolvedValue(tokenRecord);
    tx.internalSetupToken.updateMany.mockResolvedValue({ count: 1 });
    tx.internalAccount.updateMany.mockResolvedValue({ count: 1 });
    await service.activate('a'.repeat(64), 'A-strong-password-2026', {});
    const upsertCalls = tx.internalCredential.upsert.mock
      .calls as unknown as Array<
      [{ create: { accountId: string; passwordHash: string } }]
    >;
    expect(upsertCalls[0][0].create.accountId).toBe('staff-id');
    expect(upsertCalls[0][0].create.passwordHash).toMatch(/^\$argon2id\$/);
    const sessionCalls = tx.internalSession.updateMany.mock
      .calls as unknown as Array<[{ data: { revokeReason: string } }]>;
    expect(sessionCalls[0][0].data.revokeReason).toBe('PASSWORD_RESET');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INTERNAL_PASSWORD_SETUP' }),
      {},
      tx,
    );
  });
});
