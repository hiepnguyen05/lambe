import { ConflictException } from '@nestjs/common';
import { claimProviderIdentity } from './provider-identity-claim';

describe('Provider identity claim', () => {
  it('allows the owner to reuse an identity across applications', async () => {
    const transaction = {
      providerIdentityClaim: {
        createMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ userId: 'owner' }),
      },
    };
    await expect(
      claimProviderIdentity(transaction as never, 'hash', 'owner'),
    ).resolves.toBeUndefined();
    expect(transaction.providerIdentityClaim.createMany).toHaveBeenCalledWith({
      data: { nationalIdHash: 'hash', userId: 'owner' },
      skipDuplicates: true,
    });
  });
  it('does not allow another user to reuse the same identity', async () => {
    const transaction = {
      providerIdentityClaim: {
        createMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ userId: 'owner' }),
      },
    };
    await expect(
      claimProviderIdentity(transaction as never, 'hash', 'attacker'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
