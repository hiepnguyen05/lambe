import { CustomerOnboardingStatus } from '@prisma/client';

export interface PublicUserSource {
  id: string;
  phone: string;
  fullName: string | null;
  avatarUrl?: string | null;
  status: unknown;
  createdAt: Date;
  updatedAt: Date;
  roles?: { role: unknown }[];
  customerProfile?: {
    gender?: unknown;
    preferredAudience?: unknown;
    pricePreference?: unknown;
    onboardingStatus: unknown;
  } | null;
}

export function toPublicUser(user: PublicUserSource) {
  return {
    id: user.id,
    phone: user.phone,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? null,
    status: user.status,
    roles: user.roles?.map((assignment) => assignment.role) ?? [],
    gender: user.customerProfile?.gender ?? null,
    preferredAudience: user.customerProfile?.preferredAudience ?? 'ALL',
    pricePreference: user.customerProfile?.pricePreference ?? 'NO_PREFERENCE',
    onboardingStatus:
      user.customerProfile?.onboardingStatus ??
      CustomerOnboardingStatus.NOT_STARTED,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
