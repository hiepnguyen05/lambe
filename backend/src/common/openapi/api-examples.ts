export const uuidExample = '6b0f8f25-7f36-4d78-ae6f-3e834edc4f8e';
export const isoDateExample = '2026-09-29T10:30:00.000Z';

export const userExample = {
  id: uuidExample,
  phone: '+84912345678',
  fullName: 'Nguyen Minh Anh',
  avatarUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
  status: 'ACTIVE',
  roles: ['CUSTOMER'],
  gender: 'MALE',
  preferredAudience: 'MEN',
  pricePreference: 'BALANCED',
  onboardingStatus: 'COMPLETED',
  createdAt: isoDateExample,
  updatedAt: isoDateExample,
};

export const userAuthExample = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  user: userExample,
};

export const phoneLinkCheckExample = {
  canLink: true,
  existingUserId: null,
};

export const internalAccountExample = {
  id: uuidExample,
  username: 'admin',
  fullName: 'System Admin',
  email: 'admin@lambe.vn',
  roles: ['ADMIN'],
  mustChangePassword: false,
  lastLoginAt: isoDateExample,
};

export const internalAuthExample = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  account: internalAccountExample,
};

export const categoryExample = {
  id: uuidExample,
  code: 'HAIR',
  name: 'Tóc',
  slug: 'toc',
  description: 'Các dịch vụ chăm sóc và tạo kiểu tóc tại nhà.',
  iconUrl: 'scissors',
  coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/category.jpg',
  sortOrder: 1,
};

export const adminCategoryExample = {
  ...categoryExample,
  status: 'ACTIVE',
  createdAt: isoDateExample,
  updatedAt: isoDateExample,
  createdBy: {
    id: uuidExample,
    username: 'admin',
    fullName: 'System Admin',
  },
  updatedBy: {
    id: uuidExample,
    username: 'admin',
    fullName: 'System Admin',
  },
};

export const paginatedCategoriesExample = {
  data: [adminCategoryExample],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

export const serviceExample = {
  id: uuidExample,
  code: 'MEN_HAIRCUT',
  name: 'Cắt tóc nam',
  slug: 'cat-toc-nam',
  description: 'Dịch vụ cắt tóc nam tại nhà.',
  iconUrl: 'scissors',
  coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/service.jpg',
  minPriceAmount: 50000,
  maxPriceAmount: 300000,
  currencyCode: 'VND',
  defaultDurationMinutes: 45,
  targetAudience: 'MEN',
  sortOrder: 1,
  category: {
    id: uuidExample,
    code: 'HAIR',
    name: 'Tóc',
    slug: 'toc',
  },
};

export const adminServiceExample = {
  ...serviceExample,
  categoryId: uuidExample,
  requiresCertificate: false,
  minPortfolioImages: 1,
  minExperienceYears: 1,
  status: 'ACTIVE',
  createdAt: isoDateExample,
  updatedAt: isoDateExample,
  createdBy: {
    id: uuidExample,
    username: 'admin',
    fullName: 'System Admin',
  },
  updatedBy: {
    id: uuidExample,
    username: 'admin',
    fullName: 'System Admin',
  },
};

export const paginatedServicesExample = {
  data: [adminServiceExample],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

export const uploadImageExample = {
  url: 'https://res.cloudinary.com/demo/image/upload/lambe/general/image.jpg',
  publicId: 'lambe/general/image',
  width: 1200,
  height: 900,
  format: 'jpg',
};

export const customerAddressExample = {
  id: uuidExample,
  type: 'HOME',
  label: 'Nhà',
  addressLine: '12 Nguyễn Huệ, Quận 1, TP.HCM',
  provinceName: 'Thành phố Hồ Chí Minh',
  districtName: 'Quận 1',
  wardName: 'Phường Bến Nghé',
  streetLine: '12 Nguyễn Huệ',
  latitude: 10.7731,
  longitude: 106.703,
  isMapConfirmed: true,
  contactName: 'Nguyen Minh Anh',
  contactPhone: '0912345678',
  note: 'Gọi trước khi đến.',
  isDefault: true,
  createdAt: isoDateExample,
  updatedAt: isoDateExample,
};

export const adminCustomerExample = {
  id: uuidExample,
  phone: '+84912345678',
  phoneVerifiedAt: isoDateExample,
  fullName: 'Nguyen Minh Anh',
  avatarUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
  status: 'ACTIVE',
  roles: ['CUSTOMER'],
  customerProfile: {
    gender: 'MALE',
    preferredAudience: 'MEN',
    pricePreference: 'BALANCED',
    onboardingStatus: 'COMPLETED',
    completedAt: isoDateExample,
    skippedAt: null,
  },
  providerProfile: null,
  _count: { customerAddresses: 1, providerApplications: 0 },
  createdAt: isoDateExample,
  updatedAt: isoDateExample,
};

export const adminCustomerActivityExample = {
  id: uuidExample,
  actorUserId: uuidExample,
  actorInternalAccountId: null,
  action: 'USER_PROFILE_UPDATED',
  resourceType: 'User',
  resourceId: uuidExample,
  result: 'SUCCESS',
  metadata: { changedFields: ['fullName'] },
  createdAt: isoDateExample,
};

export const customerProviderApplicationSummaryExample = {
  id: uuidExample,
  providerType: 'INDIVIDUAL',
  status: 'PENDING_REVIEW',
  legalFullName: 'Nguyen Minh Anh',
  organizationName: null,
  revisionNumber: 1,
  submittedAt: isoDateExample,
  reviewedAt: null,
  decisionReason: null,
  withdrawnAt: null,
  createdAt: isoDateExample,
  updatedAt: isoDateExample,
  _count: { documents: 5, services: 2 },
};

export const onboardingProfileExample = {
  onboardingStatus: 'COMPLETED',
  gender: 'MALE',
  preferredAudience: 'MEN',
  pricePreference: 'BALANCED',
  categoryIds: [uuidExample],
  serviceIds: [uuidExample],
  categories: [categoryExample],
  services: [serviceExample],
};

export const onboardingOptionsExample = {
  categories: [
    {
      ...categoryExample,
      services: [serviceExample],
    },
  ],
};

export const recommendationExample = {
  personalized: true,
  services: [
    {
      ...serviceExample,
      recommendationScore: 70,
      reasons: ['CATEGORY_INTEREST', 'AUDIENCE_MATCH'],
    },
  ],
};

export const providerApplicationExample = {
  id: uuidExample,
  providerType: 'INDIVIDUAL',
  status: 'DRAFT',
  revisionNumber: 0,
  legalFullName: 'Nguyen Van A',
  birthDate: '1995-08-20',
  gender: 'MALE',
  email: 'provider@example.com',
  biography: 'Thợ tóc nam có 5 năm kinh nghiệm.',
  nationalIdLast4: '2345',
  experienceYears: 5,
  organizationName: null,
  submittedAt: null,
  reviewedAt: null,
  decisionReason: null,
  createdAt: isoDateExample,
  updatedAt: isoDateExample,
  checks: [
    {
      section: 'IDENTITY',
      status: 'PENDING',
      reviewNote: null,
      reviewedAt: null,
    },
  ],
  documents: [
    {
      id: uuidExample,
      type: 'PORTRAIT',
      fileFormat: 'jpg',
      isPublicCandidate: false,
      status: 'PENDING',
      reviewNote: null,
      createdAt: isoDateExample,
    },
  ],
  services: [
    {
      id: uuidExample,
      serviceId: uuidExample,
      proposedPriceAmount: 150000,
      durationMinutes: 60,
      description: 'Cắt tóc nam tại nhà.',
      status: 'PENDING',
      service: serviceExample,
    },
  ],
};

export const providerTermsExample = {
  version: '2026-09-01',
};

export const documentAccessExample = {
  url: 'https://res.cloudinary.com/demo/image/authenticated/signed-url.jpg',
  fileFormat: 'jpg',
};

export const providerSetupExample = {
  id: uuidExample,
  providerType: 'INDIVIDUAL',
  displayName: 'Minh Hair Artist',
  avatarUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
  biography: 'Chuyên cắt tóc nam tại nhà.',
  experienceYears: 5,
  status: 'ACTIVE',
  serviceAreaName: 'Quận Cầu Giấy, Hà Nội',
  serviceAreaLatitude: 21.0368,
  serviceAreaLongitude: 105.7827,
  serviceRadiusKm: 10,
  setupCompletedAt: isoDateExample,
  workingHours: [{ dayOfWeek: 1, startMinute: 480, endMinute: 1020 }],
  services: [
    {
      id: uuidExample,
      priceAmount: 150000,
      durationMinutes: 60,
      description: 'Cắt tóc nam tại nhà.',
      status: 'ACTIVE',
      service: serviceExample,
    },
  ],
};

export const providerApprovedProfileExample = {
  id: uuidExample,
  userId: uuidExample,
  sourceApplicationId: uuidExample,
  providerType: 'INDIVIDUAL',
  displayName: 'Nguyen Van A',
  avatarUrl: null,
  biography: 'Thợ tóc nam có 5 năm kinh nghiệm.',
  experienceYears: 5,
  status: 'SETUP_REQUIRED',
  serviceAreaName: null,
  serviceAreaLatitude: null,
  serviceAreaLongitude: null,
  serviceRadiusKm: null,
  setupCompletedAt: null,
  createdAt: isoDateExample,
  updatedAt: isoDateExample,
  wallet: {
    id: uuidExample,
    providerId: uuidExample,
    balanceAmount: 0,
    heldAmount: 0,
    currencyCode: 'VND',
    createdAt: isoDateExample,
    updatedAt: isoDateExample,
  },
  services: [
    {
      id: uuidExample,
      providerId: uuidExample,
      serviceId: uuidExample,
      sourceApplicationId: uuidExample,
      priceAmount: 150000,
      durationMinutes: 60,
      description: 'Cắt tóc nam tại nhà.',
      status: 'INACTIVE',
      createdAt: isoDateExample,
      updatedAt: isoDateExample,
    },
  ],
};

export const providerReviewCheckExample = {
  id: uuidExample,
  applicationId: uuidExample,
  section: 'IDENTITY',
  status: 'VERIFIED',
  reviewNote: null,
  reviewedById: uuidExample,
  reviewedAt: isoDateExample,
  createdAt: isoDateExample,
  updatedAt: isoDateExample,
};

export const availabilityStatusExample = {
  online: true,
  session: {
    id: uuidExample,
    startedAt: isoDateExample,
    lastHeartbeatAt: isoDateExample,
  },
  heartbeatTtlSeconds: 120,
};

export const availabilityHeartbeatExample = {
  online: true,
  lastHeartbeatAt: isoDateExample,
};

export const providerSearchExample = {
  data: [
    {
      id: uuidExample,
      providerType: 'INDIVIDUAL',
      displayName: 'Minh Hair Artist',
      avatarUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
      biography: 'Chuyên cắt tóc nam tại nhà.',
      experienceYears: 5,
      serviceAreaName: 'Quận Cầu Giấy, Hà Nội',
      distanceKm: 2.4,
      service: {
        id: uuidExample,
        priceAmount: 150000,
        durationMinutes: 60,
        description: 'Cắt tóc nam tại nhà.',
        service: {
          id: uuidExample,
          name: 'Cắt tóc nam',
          slug: 'cat-toc-nam',
          currencyCode: 'VND',
          targetAudience: 'MEN',
        },
      },
    },
  ],
  meta: { radiusKm: 10, count: 1 },
};

export const publicProviderExample = {
  id: uuidExample,
  providerType: 'INDIVIDUAL',
  displayName: 'Minh Hair Artist',
  avatarUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
  biography: 'Chuyên cắt tóc nam tại nhà.',
  experienceYears: 5,
  serviceAreaName: 'Quận Cầu Giấy, Hà Nội',
  online: true,
  workingHours: [{ dayOfWeek: 1, startMinute: 480, endMinute: 1020 }],
  services: [
    {
      id: uuidExample,
      priceAmount: 150000,
      durationMinutes: 60,
      description: 'Cắt tóc nam tại nhà.',
      service: {
        id: uuidExample,
        name: 'Cắt tóc nam',
        slug: 'cat-toc-nam',
        coverImageUrl:
          'https://res.cloudinary.com/demo/image/upload/service.jpg',
        currencyCode: 'VND',
        targetAudience: 'MEN',
        category: { name: 'Tóc', slug: 'toc' },
      },
    },
  ],
};

export const healthExample = {
  status: 'ok',
  database: { status: 'up' },
  cache: { status: 'up' },
};

export const successMessageExample = {
  message: 'Thao tác thành công.',
};
