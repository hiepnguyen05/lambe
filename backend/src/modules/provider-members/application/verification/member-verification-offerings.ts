import { Prisma } from '@prisma/client';

export async function loadMemberOfferings(
  tx: Prisma.TransactionClient,
  providerId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  await tx.$queryRaw(Prisma.sql`
    SELECT offering."id" FROM "provider_services" offering
    JOIN "services" service ON service."id" = offering."serviceId"
    JOIN "service_categories" category ON category."id" = service."categoryId"
    WHERE offering."providerId" = ${providerId} AND offering."id" IN (${Prisma.join(ids)})
    ORDER BY service."id", offering."id" FOR SHARE OF offering, service, category
  `);
  return tx.providerService.findMany({
    where: { providerId, id: { in: ids } },
    select: {
      id: true,
      status: true,
      service: {
        select: {
          status: true,
          category: { select: { status: true } },
          requiresCertificate: true,
          minExperienceYears: true,
          minPortfolioImages: true,
        },
      },
    },
  });
}
