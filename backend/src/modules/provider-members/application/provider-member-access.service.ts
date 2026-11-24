import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';

@Injectable()
export class ProviderMemberAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireOrganizationOwner(
    userId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = transaction ?? this.prisma;
    // Existing commercial APIs remain bound to ProviderProfile.userId in P5A.
    // Additional owners/transfers must migrate those APIs before being enabled.
    if (transaction) {
      await transaction.$queryRaw(Prisma.sql`
        SELECT "id" FROM "provider_profiles" WHERE "userId" = ${userId} FOR UPDATE
      `);
    }
    const member = await client.providerMember.findFirst({
      where: {
        userId,
        role: 'OWNER',
        status: 'ACTIVE',
        provider: {
          userId,
          providerType: 'ORGANIZATION',
          status: { not: 'SUSPENDED' },
          user: { status: 'ACTIVE' },
        },
      },
      select: { id: true, providerId: true },
    });
    if (!member) {
      throw new ForbiddenException(
        'Chỉ chủ tổ chức đang hoạt động được quản lý thành viên.',
      );
    }
    return member;
  }

  async lockProvider(
    transaction: Prisma.TransactionClient,
    providerId: string,
  ) {
    await transaction.$queryRaw(Prisma.sql`
      SELECT "id" FROM "provider_profiles" WHERE "id" = ${providerId} FOR UPDATE
    `);
  }

  async lockUser(transaction: Prisma.TransactionClient, userId: string) {
    await transaction.$queryRaw(Prisma.sql`
      SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE
    `);
  }
}
