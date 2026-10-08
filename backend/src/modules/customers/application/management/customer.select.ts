import { Prisma } from '@prisma/client';

const customerProfileSummarySelect = {
  gender: true,
  preferredAudience: true,
  pricePreference: true,
  onboardingStatus: true,
  completedAt: true,
  skippedAt: true,
} satisfies Prisma.CustomerProfileSelect;

export const adminCustomerListSelect = {
  id: true,
  phone: true,
  phoneVerifiedAt: true,
  fullName: true,
  avatarUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: true } },
  customerProfile: { select: customerProfileSummarySelect },
  providerProfile: {
    select: { id: true, displayName: true, status: true },
  },
  _count: {
    select: { customerAddresses: true, providerApplications: true },
  },
} satisfies Prisma.UserSelect;

export const adminCustomerDetailSelect = {
  ...adminCustomerListSelect,
  customerProfile: {
    select: {
      ...customerProfileSummarySelect,
      categoryInterests: {
        orderBy: { createdAt: 'asc' },
        select: {
          category: {
            select: { id: true, code: true, name: true, slug: true },
          },
        },
      },
      serviceInterests: {
        orderBy: { createdAt: 'asc' },
        select: {
          service: {
            select: {
              id: true,
              code: true,
              name: true,
              slug: true,
              status: true,
            },
          },
        },
      },
    },
  },
  customerAddresses: {
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      type: true,
      label: true,
      addressLine: true,
      provinceName: true,
      districtName: true,
      wardName: true,
      streetLine: true,
      latitude: true,
      longitude: true,
      isMapConfirmed: true,
      contactName: true,
      contactPhone: true,
      note: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  providerProfile: {
    select: {
      id: true,
      providerType: true,
      displayName: true,
      avatarUrl: true,
      status: true,
      setupCompletedAt: true,
      serviceAreaName: true,
      serviceRadiusKm: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { services: true } },
    },
  },
} satisfies Prisma.UserSelect;

export const customerProviderApplicationSelect = {
  id: true,
  providerType: true,
  status: true,
  legalFullName: true,
  organizationName: true,
  revisionNumber: true,
  submittedAt: true,
  reviewedAt: true,
  decisionReason: true,
  withdrawnAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { documents: true, services: true } },
} satisfies Prisma.ProviderApplicationSelect;

export const customerStatusResultSelect = adminCustomerListSelect;

export function mapAdminCustomer<T extends { roles: { role: string }[] }>(
  customer: T,
) {
  return {
    ...customer,
    roles: customer.roles.map(({ role }) => role),
  };
}
