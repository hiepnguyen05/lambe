import { Prisma } from '@prisma/client';

export async function lockBookingResource(
  tx: Prisma.TransactionClient,
  providerId: string,
  memberId?: string | null,
) {
  // ponytail: serialize brief writes per organization to retain legacy/global commitments.
  // Shared provider locks require a cross-user and wallet lock-order benchmark before replacing this.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "provider_profiles" WHERE "id" = ${providerId} FOR UPDATE`,
  );
  if (memberId) {
    await tx.$queryRaw(
      Prisma.sql`SELECT u."id" FROM "users" u JOIN "provider_members" m ON m."userId"=u."id" WHERE m."id"=${memberId} FOR SHARE OF u`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "provider_members" WHERE "id"=${memberId} AND "providerId"=${providerId} FOR UPDATE`,
    );
  }
}
