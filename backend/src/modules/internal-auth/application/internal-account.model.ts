import { Prisma } from '@prisma/client';

export const activeInternalAccountInclude = {
  credential: true,
  roles: { where: { revokedAt: null } },
} satisfies Prisma.InternalAccountInclude;

export type InternalAccountWithAuth = Prisma.InternalAccountGetPayload<{
  include: typeof activeInternalAccountInclude;
}>;

export function toPublicInternalAccount(account: InternalAccountWithAuth) {
  return {
    id: account.id,
    username: account.username,
    fullName: account.fullName,
    email: account.email,
    roles: account.roles.map((assignment) => assignment.role),
    mustChangePassword: account.mustChangePassword,
    lastLoginAt: account.lastLoginAt,
  };
}
