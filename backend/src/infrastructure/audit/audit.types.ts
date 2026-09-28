import type { Prisma } from '@prisma/client';

export interface AuditEvent {
  actorUserId?: string;
  actorInternalAccountId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  result: string;
  metadata?: Prisma.InputJsonValue;
}
