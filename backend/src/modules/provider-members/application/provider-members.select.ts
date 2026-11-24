import { Prisma } from '@prisma/client';

export const providerMemberSelect = {
  id: true,
  providerId: true,
  userId: true,
  role: true,
  status: true,
  canProvideServices: true,
  membershipVersion: true,
  displayName: true,
  avatarUrl: true,
  joinedAt: true,
  leftAt: true,
} satisfies Prisma.ProviderMemberSelect;

export const invitationSelect = {
  id: true,
  providerId: true,
  phone: true,
  status: true,
  expiresAt: true,
  respondedAt: true,
  revokedAt: true,
  lastSentAt: true,
  createdAt: true,
} satisfies Prisma.ProviderMemberInvitationSelect;
