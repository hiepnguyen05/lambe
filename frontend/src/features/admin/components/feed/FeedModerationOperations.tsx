import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, MessageSquareWarning, Unlock } from 'lucide-react';
import { apiRequest } from '../../../../lib/api-client';
import { useAdminAuth } from '../../hooks/useAdminAuth';

export function FeedModerationOperations() {
  const { account } = useAdminAuth();
  const client = useQueryClient();
  const [providerId, setProviderId] = useState('');
  const [note, setNote] = useState('');

  const metrics = useQuery({
    queryKey: ['feed-operations', account?.id],
    queryFn: () =>
      apiRequest<{
        data: {
          pending: number;
          oldestAgeSeconds: number;
          manualDecisions: number;
          reversedAppeals: number;
          reversalRate: number;
          averageInitialReviewSeconds: number;
        };
      }>('/internal/feed/operations'),
  });

  const commentReports = useQuery({
    queryKey: ['feed-comment-reports', account?.id],
    queryFn: () =>
      apiRequest<{
        data: {
          data: {
            id: string;
            reason: string;
            detail: string | null;
            comment: { text: string; postId: string };
          }[];
        };
      }>('/internal/feed/comment-reports'),
  });

  const mutation = useMutation({
    mutationFn: ({ url, body }: { url: string; body: unknown }) =>
      apiRequest(url, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setNote('');
      void client.invalidateQueries({ queryKey: ['feed-comment-reports'] });
      void client.invalidateQueries({ queryKey: ['feed-operations'] });
      void client.invalidateQueries({ queryKey: ['admin-feed-reports'] });
      void client.invalidateQueries({ queryKey: ['admin-feed-posts'] });
      void client.invalidateQueries({ queryKey: ['admin-feed-stats'] });
    },
  });

  const ops = metrics.data?.data;
  const commentReportItems = commentReports.data?.data?.data ?? [];
  const noteReady = note.trim().length >= 5;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Vận hành kiểm duyệt & Báo cáo bình luận</h2>
          <p className="text-xs text-slate-500">
            Theo dõi tốc độ xử lý, giải quyết báo cáo bình luận và giới hạn quyền đăng Feed của đối tác vi phạm.
          </p>
        </div>
      </div>

      {ops && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Chờ duyệt</div>
            <div className="text-lg font-extrabold text-slate-900">{ops.pending}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Chờ lâu nhất</div>
            <div className="text-lg font-extrabold text-slate-900">
              {Math.floor(ops.oldestAgeSeconds / 60)} phút
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Đã kiểm duyệt</div>
            <div className="text-lg font-extrabold text-teal-700">{ops.manualDecisions}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Đảo khiếu nại</div>
            <div className="text-lg font-extrabold text-slate-900">{ops.reversedAppeals}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Tỷ lệ đảo</div>
            <div className="text-lg font-extrabold text-slate-900">
              {Math.round(ops.reversalRate * 100)}%
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">Duyệt TB</div>
            <div className="text-lg font-extrabold text-slate-900">
              {Math.round(ops.averageInitialReviewSeconds / 60)} phút
            </div>
          </div>
        </div>
      )}

      {(metrics.isError || commentReports.isError) && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          Không tải được dữ liệu vận hành.{' '}
          <button
            type="button"
            onClick={() => {
              void metrics.refetch();
              void commentReports.refetch();
            }}
            className="font-bold underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {mutation.isError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {mutation.error instanceof Error ? mutation.error.message : 'Không lưu được quyết định.'}
        </div>
      )}

      {mutation.isSuccess && (
        <div role="status" className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          <span>Đã lưu quyết định thành công.</span>
        </div>
      )}

      <label className="block text-xs font-semibold text-slate-700">
        Lý do xử lý bình luận / hạn chế đăng Feed (tối thiểu 5 ký tự)
        <textarea
          className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs text-slate-800 focus:border-teal-600 focus:bg-white focus:outline-none"
          rows={2}
          value={note}
          maxLength={500}
          placeholder="Nhập lý do chi tiết từ 5 đến 500 ký tự..."
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <MessageSquareWarning className="h-4 w-4 text-amber-600" />
          <span>Báo cáo bình luận chờ xử lý ({commentReportItems.length})</span>
        </h3>
        {commentReportItems.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Không có báo cáo bình luận nào chờ xử lý.</p>
        ) : (
          <div className="space-y-2">
            {commentReportItems.map((r) => (
              <div
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-3.5 sm:flex-row sm:items-center"
                key={r.id}
              >
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-slate-900">"{r.comment.text}"</p>
                  <p className="text-slate-500">
                    Lý do: <strong>{r.reason}</strong>
                    {r.detail ? ` · ${r.detail}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {[false, true].map((hide) => (
                    <button
                      type="button"
                      key={String(hide)}
                      disabled={mutation.isPending || !noteReady}
                      onClick={() =>
                        mutation.mutate({
                          url: `/internal/feed/comment-reports/${r.id}`,
                          body: { hide, note: note.trim() },
                        })
                      }
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                        hide
                          ? 'bg-rose-600 text-white hover:bg-rose-700'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {hide ? 'Ẩn bình luận' : 'Không vi phạm'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {account?.roles.includes('ADMIN') && (
        <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <legend className="px-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            Quyền đăng Feed của đối tác (Admin)
          </legend>
          <p className="text-xs text-slate-500">
            Chỉ áp dụng cho quyền đăng/sửa bài trên Feed; hoạt động đặt lịch và đơn hàng vẫn giữ nguyên.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Nhập UUID đối tác..."
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-teal-600 focus:outline-none"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value.trim())}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  mutation.isPending ||
                  !noteReady ||
                  !/^[a-f0-9-]{36}$/i.test(providerId)
                }
                onClick={() =>
                  mutation.mutate({
                    url: `/internal/feed/providers/${providerId}/posting-restriction`,
                    body: { blocked: true, note: note.trim() },
                  })
                }
                className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-40"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Khóa đăng Feed</span>
              </button>
              <button
                type="button"
                disabled={
                  mutation.isPending ||
                  !noteReady ||
                  !/^[a-f0-9-]{36}$/i.test(providerId)
                }
                onClick={() =>
                  mutation.mutate({
                    url: `/internal/feed/providers/${providerId}/posting-restriction`,
                    body: { blocked: false, note: note.trim() },
                  })
                }
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
              >
                <Unlock className="h-3.5 w-3.5" />
                <span>Mở lại đăng Feed</span>
              </button>
            </div>
          </div>
        </fieldset>
      )}
    </section>
  );
}
