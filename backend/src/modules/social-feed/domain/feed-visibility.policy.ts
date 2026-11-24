import { Prisma } from '@prisma/client';

// A platform hide and an organization rejection are independent publication gates.
export const publicFeedWhere = {
  status: 'PUBLISHED',
  moderationStatus: 'APPROVED',
  OR: [
    { organizationReviewStatus: null },
    { organizationReviewStatus: 'APPROVED' },
  ],
  provider: { status: 'ACTIVE', user: { status: 'ACTIVE' } },
} satisfies Prisma.FeedPostWhereInput;
