import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  MessageSquare,
  Store,
  Video,
} from 'lucide-react';
import type { AdminFeedPostItem } from '../types';
import { formatDate, formatVnd } from '../../../../../lib/formatters';

interface FeedPostsTableProps {
  posts: AdminFeedPostItem[];
  selectedRowIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string) => void;
  onViewPost: (post: AdminFeedPostItem) => void;
  onToggleStatus: (postId: string, currentStatus: string) => void;
}

function renderModerationBadge(post: AdminFeedPostItem) {
  if (post.moderationStatus === 'PENDING') {
    return (
      <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
        Chờ kiểm duyệt
      </span>
    );
  }
  if (post.moderationStatus === 'REJECTED') {
    return (
      <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
        Bị từ chối
      </span>
    );
  }
  if (post.organizationReviewStatus === 'PENDING') {
    return (
      <span className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
        Chờ tổ chức duyệt
      </span>
    );
  }
  if (post.organizationReviewStatus === 'REJECTED') {
    return (
      <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
        Tổ chức từ chối
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
      Đã duyệt
    </span>
  );
}

export function FeedPostsTable({
  posts,
  selectedRowIds,
  onSelectAll,
  onSelectRow,
  onViewPost,
  onToggleStatus,
}: FeedPostsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm flex flex-col">
      <div className="overflow-x-auto min-h-[420px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
              <th className="py-3.5 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={posts.length > 0 && posts.every((p) => selectedRowIds.includes(p.id))}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-700 cursor-pointer"
                />
              </th>
              <th className="py-3.5 px-4">Bài đăng / Media</th>
              <th className="py-3.5 px-4">Đối tác phát hành</th>
              <th className="py-3.5 px-4">Dịch vụ đính kèm</th>
              <th className="py-3.5 px-4 text-center">Tương tác</th>
              <th className="py-3.5 px-4 text-center">Báo cáo</th>
              <th className="py-3.5 px-4 text-center">Kiểm duyệt & Hiển thị</th>
              <th className="py-3.5 px-4">Ngày đăng</th>
              <th className="py-3.5 px-5 text-right">Tác vụ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {posts.map((post) => {
              const firstMedia = post.media[0];
              const isSelected = selectedRowIds.includes(post.id);
              const isPendingReview = post.moderationStatus === 'PENDING';
              const isApproved =
                post.moderationStatus == null || post.moderationStatus === 'APPROVED';

              return (
                <tr
                  key={post.id}
                  onClick={() => onViewPost(post)}
                  className={`hover:bg-slate-50/80 transition cursor-pointer group ${
                    isSelected ? 'bg-teal-50/40' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td
                    className="py-3.5 px-4 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectRow(post.id)}
                      className="rounded border-slate-300 text-teal-700 focus:ring-teal-700 cursor-pointer"
                    />
                  </td>

                  {/* Media Thumbnail & Caption */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                        {firstMedia ? (
                          firstMedia.kind === 'VIDEO' ? (
                            <div className="relative h-full w-full">
                              <video
                                src={firstMedia.secureUrl}
                                className="h-full w-full object-cover"
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                                <Video className="h-4 w-4" />
                              </div>
                            </div>
                          ) : (
                            <img
                              src={firstMedia.secureUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          )
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                            Không ảnh
                          </div>
                        )}
                        {post.media.length > 1 && (
                          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                            +{post.media.length - 1}
                          </span>
                        )}
                      </div>
                      <div className="max-w-xs">
                        <p className="line-clamp-2 text-xs font-semibold text-slate-900 group-hover:text-teal-800 transition">
                          {post.caption || <span className="italic text-slate-400">Không có chú thích</span>}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>ID: #{post.id.slice(0, 8)}</span>
                          <span>v{post.revisionNumber}</span>
                          {post.hasCustomerConsent && (
                            <span className="text-emerald-600 font-sans font-medium">✓ Đã đồng thuận</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Provider Info */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      {post.provider.avatarUrl ? (
                        <img
                          src={post.provider.avatarUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-700 font-bold">
                          <Store className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900">
                          {post.provider.displayName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {post.authorMember?.displayName || 'Chủ tài khoản'}
                          {post.provider.feedPostingBlocked && (
                            <span className="ml-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              Khóa đăng
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Attached Services */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {post.services.length > 0 ? (
                        post.services.map((s) => (
                          <span
                            key={s.id}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            {s.name} ({formatVnd(s.price)})
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">Không có</span>
                      )}
                    </div>
                  </td>

                  {/* Engagement Likes / Comments */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center gap-2.5 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-semibold text-rose-600">
                        <Heart className="h-3 w-3 fill-rose-500" />
                        {post.counts.likes}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-sky-600">
                        <MessageSquare className="h-3 w-3" />
                        {post.counts.comments}
                      </span>
                    </div>
                  </td>

                  {/* Reports Count */}
                  <td className="py-3.5 px-4 text-center">
                    {post.unresolvedReportsCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200 animate-pulse">
                        <AlertTriangle className="h-3 w-3" />
                        {post.unresolvedReportsCount}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        0
                      </span>
                    )}
                  </td>

                  {/* Status & Moderation Status */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {renderModerationBadge(post)}
                      <span
                        className={`text-[10px] font-semibold ${
                          post.status === 'HIDDEN' ? 'text-rose-600' : 'text-slate-500'
                        }`}
                      >
                        {post.status === 'HIDDEN'
                          ? 'Đang ẩn'
                          : post.recommendationStatus === 'INELIGIBLE'
                            ? 'Hạn chế gợi ý'
                            : 'Hiển thị'}
                      </span>
                    </div>
                  </td>

                  {/* Created Date */}
                  <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                    {formatDate(post.createdAt)}
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3.5 px-5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {isPendingReview ? (
                        <button
                          type="button"
                          onClick={() => onViewPost(post)}
                          className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800 hover:bg-teal-100 transition"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Kiểm duyệt</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onViewPost(post)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                        >
                          Chi tiết
                        </button>
                      )}
                      {isApproved && (
                        <button
                          type="button"
                          onClick={() => onToggleStatus(post.id, post.status)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                            post.status === 'HIDDEN'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {post.status === 'HIDDEN' ? (
                            <>
                              <Eye className="inline h-3 w-3 mr-1" />
                              <span>Hiện lại</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="inline h-3 w-3 mr-1" />
                              <span>Ẩn bài</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
