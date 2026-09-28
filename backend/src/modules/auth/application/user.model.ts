import { CustomerOnboardingStatus } from '@prisma/client';

export interface PublicUserSource {
  id: string;
  phone: string;
  fullName: string | null;
  status: unknown;
  createdAt: Date;
  updatedAt: Date;
  roles?: { role: unknown }[];
  customerProfile?: { onboardingStatus: unknown } | null;
}

export function toPublicUser(user: PublicUserSource) {
  return {
    id: user.id,
    phone: user.phone,
    fullName: user.fullName,
    status: user.status,
    roles: user.roles?.map((assignment) => assignment.role) ?? [],
    onboardingStatus:
      user.customerProfile?.onboardingStatus ??
      CustomerOnboardingStatus.NOT_STARTED,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
