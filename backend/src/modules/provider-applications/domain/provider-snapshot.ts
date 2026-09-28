import { Prisma } from '@prisma/client';

const PRIVATE_FIELDS = new Set([
  'nationalIdNumber',
  'nationalIdEncrypted',
  'nationalIdHash',
  'fileUrl',
  'publicId',
  'ipAddress',
  'userAgent',
]);

export function buildProviderSnapshot(
  application: object,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(application, (key: string, value: unknown) =>
      PRIVATE_FIELDS.has(key) ? undefined : value,
    ),
  ) as Prisma.InputJsonValue;
}
