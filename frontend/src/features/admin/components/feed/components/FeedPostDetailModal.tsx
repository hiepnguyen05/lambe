import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  LayoutGrid,
  ShieldAlert,
  ShieldCheck,
  Store,
  X,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../../../../../lib/api-client';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { FeedDecisionHistory } from '../FeedDecisionHistory';
import {
  buildResolveReportPayload,
  buildReviewDecisionPayload,
} from '../feed-helpers';
import {
  FEED_POLICY_OPTIONS,
  type AdminFeedPostItem,
  type FeedPolicyCode,
  type FeedReportResolutionType,
} from '../types';
import { formatDate, formatVnd } from '../../../../../lib/formatters';

interface FeedPostDetailModalProps {
  post: AdminFeedPostItem | null;
  onClose: () => void;
  onToggleStatus: (postId: string, currentStatus: string) => void;
  onActionCompleted?: () => void;
}

export function FeedPostDetailModal({
  post,
  onClose,
  onToggleStatus,
  onActionCompleted,
}: FeedPostDetailModalProps) {
  const { account } = useAdminAuth();
  const isAdmin = account?.roles.includes('ADMIN') === true;
  const queryClient = useQueryClient();

  const [policyCode, setPolicyCode] = useState<FeedPolicyCode>('OTHER');
  const [note, setNote] = useState('');
  const [eligible, setEligible] = useState(true);
  const [blockMedia, setBlockMedia] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-feed-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-feed-posts'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-feed-reports'] });
    void queryClient.invalidateQueries({ queryKey: ['feed-review-queue'] });
    void queryClient.invalidateQueries({ queryKey: ['feed-review-appeals'] });
    void queryClient.invalidateQueries({ queryKey: ['feed-operations'] });
    if (post) {
      void queryClient.invalidateQueries({ queryKey: ['feed-review-history', account?.id, post.id] });
    }
    onActionCompleted?.();
  };

  const reviewMutation = useMutation({
    mutationFn: (payload: {
      decision: 'APPROVED' | 'REJECTED';
      eligible: boolean;
      blockMedia: boolean;
    }) => {
      if (!post) throw new Error('Thiếu thông tin bài viết.');
      return apiRequest(`/internal/feed/posts/${post.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify(
          buildReviewDecisionPayload({
            revisionNumber: post.revisionNumber,
            decision: payload.decision,
            eligible: payload.eligible,
            blockMedia: payload.blockMedia,
            policyCode,
            note,
          }),
        ),
      });
    },
    onSuccess: (_, variables) => {
      setActionError(null);
      setActionMessage(
        variables.decision === 'APPROVED'
          ? 'Đã duyệt bài đăng thành công.'
          : 'Đã từ chối bài đăng và ghi nhận chính sách vi phạm.',
      );
      setNote('');
      invalidateAll();
    },
    onError: (error) => {
      setActionMessage(null);
      setActionError(error instanceof Error ? error.message : 'Không thể lưu quyết định kiểm duyệt.');
    },
  });

  const resolveReportMutation = useMutation({
    mutationFn: ({
      reportId,
      resolution,
    }: {
      reportId: string;
      resolution: FeedReportResolutionType;
    }) =>
      apiRequest(`/internal/feed/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify(
          buildResolveReportPayload({ resolution, policyCode, note }),
        ),
      }),
    onSuccess: () => {
      setActionError(null);
      setActionMessage('Đã xử lý báo cáo vi phạm.');
      setNote('');
      invalidateAll();
    },
    onError: (error) => {
      setActionMessage(null);
      setActionError(error instanceof Error ? error.message : 'Không thể xử lý báo cáo.');
    },
  });

  const restrictionMutation = useMutation({
    mutationFn: (blocked: boolean) => {
      if (!post) throw new Error('Thiếu thông tin đối tác.');
      return apiRequest(`/internal/feed/providers/${post.provider.id}/posting-restriction`, {
        method: 'PATCH',
        body: JSON.stringify({ blocked, note: note.trim() }),
      });
    },
    onSuccess: (_, blocked) => {
      setActionError(null);
      setActionMessage(
        blocked ? 'Đã khóa quyền đăng Feed của đối tác.' : 'Đã mở lại quyền đăng Feed cho đối tác.',
      );
      setNote('');
      invalidateAll();
    },
    onError: (error) => {
      setActionMessage(null);
      setActionError(error instanceof Error ? error.message : 'Không thể cập nhật quyền đăng Feed.');
    },
  });

  if (!post) return null;

  const isPendingReview = post.moderationStatus === 'PENDING';
  const isApproved = post.moderationStatus == null || post.moderationStatus === 'APPROVED';
  const isBusy =
    reviewMutation.isPending || resolveReportMutation.isPending || restrictionMutation.isPending;
  const trimmedNoteLength = note.trim().length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Chi tiết & Kiểm duyệt bài Feed</h3>
              <p className="text-xs text-slate-500 font-mono">
                Mã bài viết: #{post.id} · Phiên bản {post.revisionNumber}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {actionError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
              {actionError}
            </div>
          )}
          {actionMessage && (
            <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
              {actionMessage}
            </div>
          )}

          {/* Media Gallery */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Hình ảnh / Video ({post.media.length})
            </h4>
            {post.media.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {post.media.map((item, idx) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner"
                  >
                    {item.kind === 'VIDEO' ? (
                      <video
                        src={item.secureUrl}
                        controls
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={item.secureUrl}
                        alt={`Media ${idx + 1}`}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      />
                    )}
                    <span className="absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      #{idx + 1} · {item.kind}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                Bài viết không đính kèm media
              </div>
            )}
          </div>

          {/* Caption */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Nội dung Caption
            </h4>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {post.caption || <span className="italic text-slate-400">Không có chú thích</span>}
            </div>
          </div>

          {/* Author & Moderation Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Đối tác phát hành
              </h4>
              <div className="flex items-center gap-3">
                {post.provider.avatarUrl ? (
                  <img
                    src={post.provider.avatarUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold">
                    <Store className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {post.provider.displayName}
                  </div>
                  <div className="text-xs text-slate-400">ID: {post.provider.id}</div>
                </div>
              </div>
              {isAdmin && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    {post.provider.feedPostingBlocked ? 'Đang bị khóa đăng Feed' : 'Đang được phép đăng Feed'}
                  </span>
                  <button
                    type="button"
                    disabled={isBusy || trimmedNoteLength < 5}
                    onClick={() => restrictionMutation.mutate(!post.provider.feedPostingBlocked)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-40 ${
                      post.provider.feedPostingBlocked
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <Ban className="h-3 w-3" />
                    <span>
                      {post.provider.feedPostingBlocked ? 'Mở khóa đăng Feed' : 'Khóa đăng Feed'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Trạng thái & Quyền riêng tư
              </h4>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Kiểm duyệt nền tảng:</span>
                  <span className="font-bold text-slate-900">
                    {post.moderationStatus ?? 'APPROVED'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Trạng thái hiển thị:</span>
                  <span
                    className={`font-bold ${
                      post.status === 'PUBLISHED' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Gợi ý khám phá:</span>
                  <span className="font-semibold">{post.recommendationStatus ?? 'ELIGIBLE'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Xuất hiện khách / Đồng thuận:</span>
                  <span className="font-semibold">
                    {post.includesCustomer ? 'Có' : 'Không'} / {post.hasCustomerConsent ? 'Đã xác nhận' : 'Chưa'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Ngày đăng:</span>
                  <span>{formatDate(post.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attached Services */}
          {post.services.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Dịch vụ đính kèm ({post.services.length})
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {post.services.map((srv) => (
                  <div
                    key={srv.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">{srv.name}</div>
                      <div className="text-[11px] text-slate-500">{srv.duration} phút</div>
                    </div>
                    <div className="text-xs font-extrabold text-teal-700">
                      {formatVnd(srv.price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shared Moderation Controls: Policy & Note */}
          {(isPendingReview || post.unresolvedReports.length > 0 || isAdmin) && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Biểu mẫu kiểm duyệt & Xử lý vi phạm
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Mã chính sách vi phạm
                  <select
                    value={policyCode}
                    onChange={(e) => setPolicyCode(e.target.value as FeedPolicyCode)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
                  >
                    {FEED_POLICY_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-col justify-end gap-2 text-xs text-slate-700">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eligible}
                      onChange={(e) => setEligible(e.target.checked)}
                      className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                    />
                    <span>Cho phép xuất hiện trong gợi ý khi duyệt</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={blockMedia}
                      onChange={(e) => setBlockMedia(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-600"
                    />
                    <span>Chặn tải lại media này nếu từ chối</span>
                  </label>
                </div>
              </div>

              <label className="block text-xs font-semibold text-slate-700">
                Ghi chú / Lý do xử lý (tối thiểu 5 ký tự khi từ chối, hạn chế gợi ý hoặc khóa quyền đăng)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Nhập lý do kiểm duyệt hoặc xử lý vi phạm (từ 5 đến 500 ký tự)..."
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                />
              </label>

              {isPendingReview && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isBusy || (!eligible && trimmedNoteLength < 5)}
                    onClick={() =>
                      reviewMutation.mutate({
                        decision: 'APPROVED',
                        eligible,
                        blockMedia: false,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{eligible ? 'Duyệt & Công khai' : 'Duyệt (Hạn chế gợi ý)'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || trimmedNoteLength < 5}
                    onClick={() =>
                      reviewMutation.mutate({
                        decision: 'REJECTED',
                        eligible: false,
                        blockMedia,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Từ chối vi phạm</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Unresolved Reports on this Post */}
          {post.unresolvedReports.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Báo cáo vi phạm đang chờ xử lý ({post.unresolvedReports.length})
              </h4>
              <div className="space-y-2">
                {post.unresolvedReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between font-semibold text-rose-800">
                      <span>Lý do: {rep.reason}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {formatDate(rep.createdAt)}
                      </span>
                    </div>
                    {rep.detail && (
                      <p className="text-slate-700 italic">"{rep.detail}"</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          resolveReportMutation.mutate({
                            reportId: rep.id,
                            resolution: 'NO_VIOLATION',
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Không vi phạm
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          resolveReportMutation.mutate({
                            reportId: rep.id,
                            resolution: 'CONTENT_RESTRICTED',
                          })
                        }
                        className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        Hạn chế gợi ý
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          resolveReportMutation.mutate({
                            reportId: rep.id,
                            resolution: 'CONTENT_REMOVED',
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        <span>Gỡ khỏi Feed</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <FeedDecisionHistory postId={post.id} />
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="font-semibold text-rose-600">❤️ {post.counts.likes} thích</span>
            <span className="font-semibold text-sky-600">💬 {post.counts.comments} bình luận</span>
          </div>

          <div className="flex items-center gap-2">
            {isApproved && (
              <button
                type="button"
                onClick={() => onToggleStatus(post.id, post.status)}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition ${
                  post.status === 'HIDDEN'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                }`}
              >
                {post.status === 'HIDDEN' ? (
                  <>
                    <Eye className="h-4 w-4" />
                    <span>Hiện lại bài đăng</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    <span>Ẩn bài đăng</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
