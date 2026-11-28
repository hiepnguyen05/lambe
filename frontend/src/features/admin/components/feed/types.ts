export interface FeedStats {
  totalPosts: number;
  publishedPosts: number;
  hiddenPosts: number;
  pendingModeration?: number;
  pendingReports: number;
  totalLikes: number;
  totalComments: number;
}

export interface AdminFeedPostMedia {
  id: string;
  secureUrl: string;
  kind: 'IMAGE' | 'VIDEO';
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  position: number;
}

export interface AdminFeedPostService {
  id: string;
  name: string;
  price: number;
  duration: number;
}

export interface AdminFeedPostItem {
  id: string;
  caption: string | null;
  status: 'PUBLISHED' | 'HIDDEN' | 'DRAFT' | 'DELETED';
  includesCustomer: boolean;
  hasCustomerConsent: boolean;
  revisionNumber: number;
  organizationReviewStatus: string | null;
  moderationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  recommendationStatus?: 'ELIGIBLE' | 'INELIGIBLE';
  moderationPolicyCode?: string | null;
  moderationNote?: string | null;
  safetyScore?: number;
  safetyLabels?: string[];
  createdAt: string;
  updatedAt: string;
  provider: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    feedPostingBlocked?: boolean;
  };
  authorMember: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  media: AdminFeedPostMedia[];
  services: AdminFeedPostService[];
  counts: {
    likes: number;
    comments: number;
    saves: number;
    reports: number;
  };
  unresolvedReportsCount: number;
  unresolvedReports: Array<{
    id: string;
    reason: string;
    detail: string | null;
    createdAt: string;
  }>;
}

export interface AdminFeedPostsResponse {
  data: AdminFeedPostItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type FeedReportResolutionType =
  | 'DISMISSED'
  | 'POST_HIDDEN'
  | 'NO_VIOLATION'
  | 'CONTENT_RESTRICTED'
  | 'CONTENT_REMOVED';

export interface AdminFeedReportItem {
  id: string;
  postId: string;
  userId: string;
  reason: string;
  detail?: string | null;
  createdAt: string;
  resolution?: FeedReportResolutionType | null;
  reviewedAt?: string | null;
  policyCode?: string | null;
  note?: string | null;
  user?: {
    id: string;
    fullName?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
  } | null;
  reviewedBy?: {
    id: string;
    username: string;
    fullName?: string | null;
  } | null;
  post: {
    id: string;
    caption?: string | null;
    status: string;
    providerId: string;
    provider?: {
      id: string;
      displayName: string;
      avatarUrl?: string | null;
    };
    media: Array<{
      id: string;
      secureUrl: string;
      kind: string;
    }>;
  };
}

export interface AdminFeedReportsEnvelope {
  data: AdminFeedReportItem[];
}

export const FEED_POLICY_OPTIONS = [
  { code: 'SEXUAL_OR_NUDITY', label: 'Nội dung nhạy cảm / khỏa thân' },
  { code: 'PRIVACY_OR_NO_CONSENT', label: 'Quyền riêng tư / chưa có đồng thuận' },
  { code: 'MISLEADING_OR_MEDICAL_CLAIM', label: 'Thông tin sai lệch / cam kết y khoa' },
  { code: 'SPAM_OR_SCAM', label: 'Spam / lừa đảo' },
  { code: 'VIOLENCE_OR_GRAPHIC', label: 'Bạo lực / hình ảnh gây phản cảm' },
  { code: 'COPYRIGHT_OR_REUPLOAD', label: 'Vi phạm bản quyền / đăng lại' },
  { code: 'OTHER', label: 'Lý do khác' },
] as const;

export type FeedPolicyCode = (typeof FEED_POLICY_OPTIONS)[number]['code'];

export const REASON_LABELS: Record<string, { label: string; badgeClass: string }> = {
  INAPPROPRIATE: { label: 'Nội dung phản cảm', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  SPAM: { label: 'Spam / Lừa đảo', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  COPYRIGHT: { label: 'Bản quyền', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  HARASSMENT: { label: 'Quấy rối / Công kích', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  PRIVACY: { label: 'Quyền riêng tư', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  VIOLATION: { label: 'Vi phạm chính sách', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
};
