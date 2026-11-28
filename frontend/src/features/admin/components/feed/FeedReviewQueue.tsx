import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../../../../lib/api-client';
import { FeedDecisionHistory } from './FeedDecisionHistory';
import { buildReviewDecisionPayload } from './feed-helpers';
import { FEED_POLICY_OPTIONS, type FeedPolicyCode } from './types';

type Post = {
  id: string;
  caption: string;
  revisionNumber: number;
  safetyScore: number;
  safetyLabels: string[];
  reports: number;
  engagements: number;
  includesCustomer: boolean;
  hasCustomerConsent: boolean;
  provider: { displayName: string };
  media: { id: string; kind: string; url: string }[];
  services: { providerService: { id: string; service: { name: string } } }[];
};

export function FeedReviewQueue() {
  const client = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>();
  const [selected, setSelected] = useState<Post | null>(null);
  const [policy, setPolicy] = useState<FeedPolicyCode>('OTHER');
  const [note, setNote] = useState('');
  const [eligible, setEligible] = useState(true);
  const [blockMedia, setBlockMedia] = useState(false);

  const queue = useQuery({
    queryKey: ['feed-review-queue', cursor],
    queryFn: () =>
      apiRequest<{ data: { data: Post[]; nextCursor: string | null } }>(
        `/internal/feed/review-queue?limit=10${cursor ? `&cursor=${cursor}` : ''}`,
      ),
  });

  const appeals = useQuery({
    queryKey: ['feed-review-appeals'],
    queryFn: () =>
      apiRequest<{
        data: {
          data: {
            id: string;
            reason: string;
            postId: string;
            post: {
              caption: string;
              moderationNote: string | null;
              media: { id: string; kind: string; secureUrl: string }[];
            };
          }[];
        };
      }>('/internal/feed/appeals'),
  });

  const mutation = useMutation({
    mutationFn: async ({ url, body }: { url: string; body: unknown }) =>
      apiRequest(url, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setSelected(null);
      setNote('');
      void client.invalidateQueries({ queryKey: ['feed-review-queue'] });
      void client.invalidateQueries({ queryKey: ['feed-review-appeals'] });
      void client.invalidateQueries({ queryKey: ['admin-feed-posts'] });
      void client.invalidateQueries({ queryKey: ['admin-feed-stats'] });
      void client.invalidateQueries({ queryKey: ['feed-operations'] });
    },
  });

  const decide = (decision: 'APPROVED' | 'REJECTED') => {
    if (!selected) return;
    mutation.mutate({
      url: `/internal/feed/posts/${selected.id}/review`,
      body: buildReviewDecisionPayload({
        revisionNumber: selected.revisionNumber,
        decision,
        eligible,
        blockMedia,
        policyCode: policy,
        note,
      }),
    });
  };

  const queueItems = queue.data?.data?.data ?? [];
  const appealItems = appeals.data?.data?.data ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Hàng chờ kiểm duyệt bài đăng</h2>
            <p className="text-xs text-slate-500">
              Bài đăng chỉ hiển thị công khai sau khi được kiểm duyệt và đủ điều kiện từ tổ chức.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCursor(undefined);
                void queue.refetch();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${queue.isFetching ? 'animate-spin' : ''}`} />
              <span>Tải lại hàng chờ</span>
            </button>
            {queue.data?.data?.nextCursor && (
              <button
                type="button"
                onClick={() => setCursor(queue.data!.data.nextCursor!)}
                className="rounded-xl border border-slate-200 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Trang tiếp
              </button>
            )}
          </div>
        </div>

        {queue.isError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            Không tải được hàng chờ kiểm duyệt.{' '}
            <button type="button" onClick={() => void queue.refetch()} className="underline font-bold">
              Thử lại
            </button>
          </div>
        )}

        {mutation.isError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Không thể lưu quyết định. Hãy tải lại phiên bản mới.'}
          </div>
        )}

        {queue.isLoading ? (
          <div className="flex items-center justify-center py-10 text-xs text-slate-500">
            <LoaderCircle className="h-5 w-5 animate-spin text-teal-700 mr-2" />
            <span>Đang tải hàng chờ kiểm duyệt...</span>
          </div>
        ) : queueItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <ShieldCheck className="h-10 w-10 text-emerald-500" />
            <p className="mt-2 text-sm font-bold text-slate-800">Không có bài viết chờ kiểm duyệt</p>
            <p className="text-xs text-slate-500">Tất cả bài đăng mới đã được xem xét.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {queueItems.map((post) => {
              const isSelected = selected?.id === post.id;
              return (
                <button
                  type="button"
                  key={post.id}
                  onClick={() => {
                    setSelected(post);
                    setNote('');
                    setEligible(true);
                    setBlockMedia(false);
                    mutation.reset();
                  }}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {post.provider.displayName}
                      </span>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        Phiên bản {post.revisionNumber}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-700">
                      {post.caption || <span className="italic text-slate-400">Không có chú thích</span>}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span>Rủi ro: <strong>{post.safetyScore}</strong></span>
                    <span>Báo cáo: <strong>{post.reports}</strong></span>
                    <span>Tương tác: <strong>{post.engagements}</strong></span>
                    <span>Media: <strong>{post.media.length}</strong></span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="space-y-4 rounded-2xl border border-teal-200 bg-slate-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selected.provider.displayName}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  Bài #{selected.id} · Phiên bản {selected.revisionNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Đóng khung duyệt
              </button>
            </div>

            <p className="rounded-xl bg-white p-3 text-sm text-slate-800 border border-slate-200 whitespace-pre-wrap">
              {selected.caption || 'Không có chú thích'}
            </p>

            <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Dịch vụ gắn bài</span>
                <span className="font-semibold text-slate-800">
                  {selected.services?.map((link) => link.providerService.service.name).join(', ') || 'Không có'}
                </span>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Tín hiệu tự động</span>
                <span className="font-semibold text-slate-800">
                  {selected.safetyLabels?.join(', ') || 'Không có cảnh báo'}
                </span>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Khách hàng / Consent</span>
                <span className="font-semibold text-slate-800">
                  {selected.includesCustomer ? 'Có mặt khách' : 'Không'} ·{' '}
                  {selected.hasCustomerConsent ? 'Đã đồng thuận' : 'Chưa xác nhận'}
                </span>
              </div>
            </div>

            {selected.media.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selected.media.map((m) =>
                  m.kind === 'VIDEO' ? (
                    <video
                      key={m.id}
                      controls
                      preload="metadata"
                      src={m.url}
                      className="max-h-72 w-full rounded-xl border border-slate-200 bg-black object-cover"
                    />
                  ) : (
                    <img
                      key={m.id}
                      src={m.url}
                      alt="Ảnh bài chờ duyệt"
                      className="max-h-72 w-full rounded-xl border border-slate-200 object-cover"
                    />
                  ),
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Chính sách
                <select
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value as FeedPolicyCode)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
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
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Cho phép xuất hiện trong gợi ý khi duyệt</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockMedia}
                    onChange={(e) => setBlockMedia(e.target.checked)}
                    className="rounded border-slate-300 text-rose-600"
                  />
                  <span>Chặn tải lại media này nếu từ chối</span>
                </label>
              </div>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Lý do kiểm duyệt (bắt buộc tối thiểu 5 ký tự khi từ chối hoặc hạn chế gợi ý)
              <textarea
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập lý do chi tiết..."
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={mutation.isPending || (!eligible && note.trim().length < 5)}
                onClick={() => decide('APPROVED')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{eligible ? 'Duyệt bài' : 'Duyệt (Hạn chế gợi ý)'}</span>
              </button>
              <button
                type="button"
                disabled={mutation.isPending || note.trim().length < 5}
                onClick={() => decide('REJECTED')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                <span>Từ chối</span>
              </button>
            </div>

            <FeedDecisionHistory postId={selected.id} />
          </div>
        )}
      </section>

      {/* Appeals Section */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Khiếu nại chờ xử lý ({appealItems.length})</h2>
          <p className="text-xs text-slate-500">
            Nhập lý do tối thiểu 5 ký tự trước khi phản hồi khiếu nại. Người ra quyết định ban đầu không thể tự xét khiếu nại.
          </p>
        </div>

        {appeals.isError && (
          <p role="alert" className="text-xs font-semibold text-rose-600">
            Không tải được danh sách khiếu nại.
          </p>
        )}

        {!selected && appealItems.length > 0 && (
          <textarea
            aria-label="Lý do xử lý khiếu nại"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập lý do giữ quyết định hoặc chấp nhận khiếu nại (5–500 ký tự)..."
            className="block w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs text-slate-800"
          />
        )}

        {appealItems.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Hiện chưa có khiếu nại nào chờ xử lý.</p>
        ) : (
          <div className="space-y-3">
            {appealItems.map((a) => (
              <div className="space-y-3 rounded-xl border border-slate-200 p-4" key={a.id}>
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-slate-900">{a.post.caption || 'Không có mô tả'}</p>
                  <p className="text-slate-600">
                    <strong>Quyết định trước:</strong> {a.post.moderationNote || 'Không có ghi chú'}
                  </p>
                  <p className="text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200">
                    <strong>Nội dung khiếu nại:</strong> {a.reason}
                  </p>
                </div>
                {a.post.media.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {a.post.media.map((m) =>
                      m.kind === 'VIDEO' ? (
                        <video
                          key={m.id}
                          controls
                          preload="metadata"
                          src={m.secureUrl}
                          className="max-h-56 rounded-xl border border-slate-200"
                        />
                      ) : (
                        <img
                          key={m.id}
                          src={m.secureUrl}
                          alt="Nội dung khiếu nại"
                          className="max-h-56 rounded-xl border border-slate-200 object-cover"
                        />
                      ),
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(['UPHELD', 'REVERSED'] as const).map((d) => (
                    <button
                      type="button"
                      key={d}
                      disabled={mutation.isPending || note.trim().length < 5}
                      onClick={() =>
                        mutation.mutate({
                          url: `/internal/feed/appeals/${a.id}`,
                          body: { decision: d, note: note.trim() },
                        })
                      }
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 ${
                        d === 'REVERSED'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {d === 'UPHELD' ? 'Giữ quyết định cũ' : 'Chấp nhận khiếu nại'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
