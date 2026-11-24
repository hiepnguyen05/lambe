import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export async function claimProviderIdentity(
  transaction: Prisma.TransactionClient,
  hash: string,
  userId: string,
): Promise<void> {
  await transaction.providerIdentityClaim.createMany({
    data: { nationalIdHash: hash, userId },
    skipDuplicates: true,
  });
  const claim = await transaction.providerIdentityClaim.findUnique({
    where: { nationalIdHash: hash },
  });
  if (!claim || claim.userId !== userId) {
    throw new ConflictException(
      'Số CCCD này đã được sử dụng bởi tài khoản khác.',
    );
  }
}
