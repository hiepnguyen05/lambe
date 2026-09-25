import { SetMetadata } from '@nestjs/common';
import type { InternalRole } from '@prisma/client';

export const INTERNAL_ROLES_KEY = 'internal_roles';
export const InternalRoles = (...roles: InternalRole[]) =>
  SetMetadata(INTERNAL_ROLES_KEY, roles);
