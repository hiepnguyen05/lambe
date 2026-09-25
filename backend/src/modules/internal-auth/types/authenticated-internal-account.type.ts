import type { InternalRole } from '@prisma/client';

export interface AuthenticatedInternalAccount {
  accountId: string;
  username: string;
  roles: InternalRole[];
  sessionId: string;
}
