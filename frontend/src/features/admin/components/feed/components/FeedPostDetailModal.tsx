import { AlertTriangle, Eye, EyeOff, LayoutGrid, Store, X } from 'lucide-react';
import type { AdminFeedPostItem } from '../types';
import { FeedDecisionHistory } from '../FeedDecisionHistory';
import { formatDate, formatVnd } from '../../../../../lib/formatters';

interface FeedPostDetailModalProps {
  post: AdminFeedPostItem | null;
  onClose: () => void;
  onToggleStatus: (postId: string, currentStatus: string) => void;
}

export function FeedPostDetailModal({
  post,
  onClose,
  onToggleStatus,
}: FeedPostDetailModalProps) {
  if (!post) return null;

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
              <h3 className="text-lg font-bold text-slate-900">Chi tiết bài đăng Feed</h3>
              <p className="text-xs text-slate-500 font-mono">Mã bài viết: #{post.id}</p>
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
          <FeedDecisionHistory postId={post.id} />
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
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-800 leading-relaxed">
              {post.caption || <span className="italic text-slate-400">Không có chú thích</span>}
            </div>
          </div>

          {/* Author & Provider Info */}
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
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Trạng thái & Quyền riêng tư
              </h4>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Trạng thái:</span>
                  <span
                    className={`font-bold ${
                      post.status === 'PUBLISHED' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Xuất hiện khách hàng:</span>
                  <span className="font-semibold">
                    {post.includesCustomer ? 'Có' : 'Không'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Đã có đồng thuận khách:</span>
                  <span className="font-semibold">
                    {post.hasCustomerConsent ? 'Đã xác nhận' : 'Chưa'}
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
                    className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-rose-800">
                      <span>Lý do: {rep.reason}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {formatDate(rep.createdAt)}
                      </span>
                    </div>
                    {rep.detail && (
                      <p className="mt-1 text-slate-700 italic">"{rep.detail}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="font-semibold text-rose-600">❤️ {post.counts.likes} thích</span>
            <span className="font-semibold text-sky-600">💬 {post.counts.comments} bình luận</span>
          </div>

          <div className="flex items-center gap-2">
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

