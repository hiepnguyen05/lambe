import type {
  AdminFeedReportItem,
  FeedPolicyCode,
  FeedReportResolutionType,
} from './types';

export function unwrapFeedReports(payload: unknown): AdminFeedReportItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const outer = (payload as { data?: unknown }).data;
  if (Array.isArray(outer)) {
    return outer as AdminFeedReportItem[];
  }
  if (outer && typeof outer === 'object') {
    const inner = (outer as { data?: unknown }).data;
    if (Array.isArray(inner)) {
      return inner as AdminFeedReportItem[];
    }
  }
  return [];
}

export function buildReviewDecisionPayload(input: {
  revisionNumber: number;
  decision: 'APPROVED' | 'REJECTED';
  eligible: boolean;
  blockMedia?: boolean;
  policyCode: FeedPolicyCode;
  note: string;
}) {
  const trimmedNote = input.note.trim();
  const isApproved = input.decision === 'APPROVED';
  const eligible = isApproved && input.eligible;
  const needsReason = !isApproved || !eligible;

  return {
    revisionNumber: input.revisionNumber,
    decision: input.decision,
    eligible,
    blockMedia: !isApproved && Boolean(input.blockMedia),
    ...(needsReason
      ? {
          policyCode: input.policyCode,
          note: trimmedNote,
        }
      : {}),
  };
}

export function buildResolveReportPayload(input: {
  resolution: FeedReportResolutionType;
  policyCode: FeedPolicyCode;
  note: string;
}) {
  const trimmedNote = input.note.trim();
  return {
    resolution: input.resolution,
    policyCode: input.policyCode,
    ...(trimmedNote.length >= 5 ? { note: trimmedNote } : {}),
  };
}
