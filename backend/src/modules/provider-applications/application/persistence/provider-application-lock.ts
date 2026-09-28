import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ProviderApplicationStatus } from '@prisma/client';

// Every writer locks the parent before reading or changing its children.
export async function lockProviderApplication(
  transaction: Prisma.TransactionClient,
  id: string,
  userId?: string,
) {
  const rows = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "provider_applications"
    WHERE "id" = ${id} AND (${userId ?? null}::text IS NULL OR "userId" = ${userId ?? null})
    FOR UPDATE
  `);
  if (!rows.length) {
    throw new NotFoundException('Không tìm thấy hồ sơ đăng ký nhà cung cấp.');
  }
}

export function assertPendingApplication(status: ProviderApplicationStatus) {
  if (status !== ProviderApplicationStatus.PENDING_REVIEW) {
    throw new ConflictException('Hồ sơ không ở trạng thái chờ xét duyệt.');
  }
}

export async function lockProviderCatalog(
  transaction: Prisma.TransactionClient,
  applicationId: string,
): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`
    SELECT service."id" FROM "services" service
    JOIN "service_categories" category ON category."id" = service."categoryId"
    JOIN "provider_application_services" item ON item."serviceId" = service."id"
    WHERE item."applicationId" = ${applicationId}
    ORDER BY service."id" FOR SHARE OF service, category
  `);
}
