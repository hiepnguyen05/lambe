import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { InternalRole } from '@prisma/client';
import { InternalAccountsService } from './internal-accounts.service';

const actor = {
  accountId: 'admin-id',
  username: 'admin',
  roles: [InternalRole.ADMIN],
  sessionId: 'session-id',
};
const request = { ipAddress: '127.0.0.1' };

function fixture() {
  const tx = {
    internalAccount: {
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    internalRoleAssignment: { updateMany: jest.fn(), upsert: jest.fn() },
    internalSession: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    internalAccount: { findUnique: jest.fn() },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const setup = { ensureMailAvailable: jest.fn(), issue: jest.fn() };
  const service = new InternalAccountsService(
    prisma as never,
    audit as never,
    setup as never,
  );
  return { service, tx, prisma, audit, setup };
}

describe('InternalAccountsService', () => {
  it('refuses to remove the last active ADMIN role', async () => {
    const { service, tx } = fixture();
    tx.internalAccount.findUnique.mockResolvedValue({
      id: 'admin-id',
      status: 'ACTIVE',
      roles: [{ role: InternalRole.ADMIN }],
    });
    tx.internalAccount.count.mockResolvedValue(0);
    await expect(
      service.replaceRoles('admin-id', [InternalRole.SUPPORT], actor, request),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.internalRoleAssignment.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to disable the last active ADMIN', async () => {
    const { service, tx } = fixture();
    tx.internalAccount.findUnique.mockResolvedValue({
      id: 'admin-id',
      status: 'ACTIVE',
      roles: [{ role: InternalRole.ADMIN }],
      credential: {},
    });
    tx.internalAccount.count.mockResolvedValue(0);
    await expect(
      service.setDisabled('admin-id', true, actor, request),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.internalAccount.update).not.toHaveBeenCalled();
  });

  it('revokes sessions and increments token version when roles change', async () => {
    const { service, tx, prisma } = fixture();
    tx.internalAccount.findUnique.mockResolvedValue({
      id: 'staff-id',
      status: 'ACTIVE',
      roles: [{ role: InternalRole.SUPPORT }],
    });
    prisma.internalAccount.findUnique.mockResolvedValue({
      id: 'staff-id',
      username: 'staff',
      fullName: 'Staff',
      email: 'staff@example.com',
      status: 'ACTIVE',
      roles: [{ role: InternalRole.MODERATOR }],
    });
    await service.replaceRoles(
      'staff-id',
      [InternalRole.MODERATOR],
      actor,
      request,
    );
    expect(tx.internalAccount.update).toHaveBeenCalledWith({
      where: { id: 'staff-id' },
      data: { tokenVersion: { increment: 1 } },
    });
    const calls = tx.internalSession.updateMany.mock.calls as unknown as Array<
      [{ data: { revokeReason: string } }]
    >;
    expect(calls[0][0].data.revokeReason).toBe('ROLES_CHANGED');
  });

  it('refuses invitations when SMTP is disabled', async () => {
    const { service, setup, prisma } = fixture();
    setup.ensureMailAvailable.mockImplementation(() => {
      throw new ServiceUnavailableException();
    });
    await expect(
      service.create(
        {
          username: 'staff',
          fullName: 'Staff',
          email: 'staff@example.com',
          roles: [InternalRole.SUPPORT],
        },
        actor,
        request,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not use enable to bypass a login lock', async () => {
    const { service, tx } = fixture();
    tx.internalAccount.findUnique.mockResolvedValue({
      id: 'staff-id',
      status: 'LOCKED',
      roles: [{ role: InternalRole.SUPPORT }],
      credential: {},
    });
    await expect(
      service.setDisabled('staff-id', false, actor, request),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.internalAccount.update).not.toHaveBeenCalled();
  });
});
