import type { Prisma } from '@prisma/client';

export const publicReviewSelect = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  memberId: true,
  memberDisplayName: true,
  memberAvatarUrl: true,
} satisfies Prisma.OrderReviewSelect;

type PublicReview = Prisma.OrderReviewGetPayload<{
  select: typeof publicReviewSelect;
}>;

export function presentReview(review: PublicReview) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    assignedMember: review.memberId
      ? {
          id: review.memberId,
          displayName: review.memberDisplayName,
          avatarUrl: review.memberAvatarUrl,
        }
      : null,
  };
}

export interface ReviewSummary {
  count: number;
  averageRating: number | null;
}
