export const publicFeedPostExample = {
  id: '429790e4-04a9-45c1-8014-0e6031111cbe',
  status: 'PUBLISHED',
  caption: 'Mẫu tóc đã thực hiện tại nhà khách.',
  revisionNumber: 1,
  provider: {
    id: 'b476f4b1-1781-4006-a8ca-b5fd06877736',
    displayName: 'Lambe Beauty Partner',
    avatarUrl: null,
  },
  authorMember: {
    id: '216a1b81-4061-42be-b08a-3497522fb430',
    displayName: 'Nguyễn Văn An',
    avatarUrl: null,
  },
  media: [
    {
      id: '6b601aac-663b-4ee2-a23c-c087f7d373d0',
      kind: 'IMAGE',
      url: 'https://example.com/portfolio.webp',
      width: 1080,
      height: 1080,
      durationSeconds: null,
      position: 0,
    },
  ],
  services: [
    {
      id: '732f0589-4d37-4627-b0eb-4f46cb5b7118',
      priceAmount: 150000,
      durationMinutes: 60,
      status: 'ACTIVE',
      service: {
        id: '41a85643-b755-442e-b2c1-060889ab381c',
        name: 'Cắt tóc nam',
        categoryId: '3bea9752-fce9-422b-97c3-b855d09bc83f',
      },
    },
  ],
  counts: { likes: 0, comments: 0, saves: 0 },
  viewer: { liked: false, saved: false, followed: false },
  createdAt: '2026-10-29T05:00:00.000Z',
  updatedAt: '2026-10-29T05:00:00.000Z',
  sharePath: '/feed/posts/429790e4-04a9-45c1-8014-0e6031111cbe',
};
export const managedFeedPostExample = {
  ...publicFeedPostExample,
  moderation: {
    status: 'PENDING',
    recommendationStatus: 'INELIGIBLE',
    policyCode: null,
    note: null,
    reviewedAt: null,
  },
  organizationReview: { status: 'PENDING', reviewedAt: null, note: null },
};
