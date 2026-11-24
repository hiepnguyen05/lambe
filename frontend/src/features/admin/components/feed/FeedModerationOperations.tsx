import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../../lib/api-client";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import type { AdminFeedReportItem } from './types';

export function FeedModerationOperations({postReports=[]}:{postReports?:AdminFeedReportItem[]}) {
  const { account } = useAdminAuth();
  const client = useQueryClient();
  const [providerId, setProviderId] = useState(""),
    [note, setNote] = useState("");
  const [policyCode,setPolicyCode]=useState('OTHER');
  const metrics = useQuery({
    queryKey: ["feed-operations", account?.id],
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
      }>("/internal/feed/operations"),
  });
  const reports = useQuery({
    queryKey: ["feed-comment-reports", account?.id],
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
      }>("/internal/feed/comment-reports"),
  });
  const mutation = useMutation({
    mutationFn: ({ url, body }: { url: string; body: unknown }) =>
      apiRequest(url, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["feed-comment-reports"] });
      void client.invalidateQueries({ queryKey: ["feed-operations"] });
      void client.invalidateQueries({queryKey:['admin-feed-reports']});
      void client.invalidateQueries({queryKey:['admin-feed-posts']});
      void client.invalidateQueries({queryKey:['admin-feed-stats']});
    },
  });
  return (
    <section className="space-y-3 rounded-xl bg-white p-5">
      <h2 className="text-lg font-semibold">Vận hành kiểm duyệt</h2>
      {metrics.data && (
        <p>
          Chờ duyệt: {metrics.data.data.pending} · Chờ lâu nhất:{" "}
          {Math.floor(metrics.data.data.oldestAgeSeconds / 60)} phút · Đã duyệt:{" "}
          {metrics.data.data.manualDecisions} · Khiếu nại được chấp nhận:{" "}
          {metrics.data.data.reversedAppeals}
          {" · Tỷ lệ đảo quyết định: "}
          {Math.round(metrics.data.data.reversalRate * 100)}%
          {" · Duyệt lần đầu trung bình: "}
          {Math.round(metrics.data.data.averageInitialReviewSeconds / 60)} phút
        </p>
      )}
      {(metrics.isError || reports.isError) && (
        <p role="alert">
          Không tải được dữ liệu vận hành.{" "}
          <button
            onClick={() => {
              void metrics.refetch();
              void reports.refetch();
            }}
          >
            Thử lại
          </button>
        </p>
      )}
      {mutation.isError && (
        <p role="alert">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Không lưu được quyết định."}
        </p>
      )}
      {mutation.isSuccess && <p role="status">Đã lưu quyết định.</p>}
      <label className="block">
        Lý do xử lý (5–500 ký tự)
        <textarea
          className="block w-full border p-2"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <h3 className="font-semibold">Báo cáo bình luận</h3>
      <details className="rounded border p-3"><summary>Quyết định có lý do cho báo cáo bài đăng</summary><label>Chính sách <select value={policyCode} onChange={e=>setPolicyCode(e.target.value)}>{[['SEXUAL_OR_NUDITY','Nội dung tình dục/khỏa thân'],['PRIVACY_OR_NO_CONSENT','Quyền riêng tư/consent'],['MISLEADING_OR_MEDICAL_CLAIM','Thông tin sai lệch'],['SPAM_OR_SCAM','Spam/lừa đảo'],['VIOLENCE_OR_GRAPHIC','Nội dung ghê rợn'],['COPYRIGHT_OR_REUPLOAD','Bản quyền/đăng lại'],['OTHER','Khác']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{postReports.map(r=><div key={r.id} className="my-2 rounded border p-3"><p>{r.post.caption} · {r.reason}</p><p>Xem đầy đủ media trong bảng báo cáo bên dưới trước khi quyết định.</p>{([['NO_VIOLATION','Không vi phạm'],['CONTENT_RESTRICTED','Hạn chế gợi ý'],['CONTENT_REMOVED','Gỡ khỏi Feed']] as const).map(([resolution,label])=><button key={resolution} className="mr-3" disabled={mutation.isPending||note.trim().length<5} onClick={()=>mutation.mutate({url:`/internal/feed/reports/${r.id}`,body:{resolution,policyCode,note:note.trim()}})}>{label}</button>)}</div>)}</details>
      {reports.data?.data.data.length === 0 && (
        <p>Không có báo cáo chờ xử lý.</p>
      )}
      {reports.data?.data.data.map((r) => (
        <div className="rounded border p-3" key={r.id}>
          <p>{r.comment.text}</p>
          <p>
            {r.reason} · {r.detail}
          </p>
          {[true, false].map((hide) => (
            <button
              className="mr-4"
              key={String(hide)}
              disabled={mutation.isPending || note.trim().length < 5}
              onClick={() =>
                mutation.mutate({
                  url: `/internal/feed/comment-reports/${r.id}`,
                  body: { hide, note: note.trim() },
                })
              }
            >
              {hide ? "Ẩn bình luận" : "Không vi phạm"}
            </button>
          ))}
        </div>
      ))}
      {account?.roles.includes("ADMIN") && (
        <fieldset className="space-y-2 border p-3">
          <legend>Quyền đăng Feed của đối tác</legend>
          <label>
            ID đối tác
            <input
              className="block w-full border p-2"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value.trim())}
            />
          </label>
          <p>
            Thay đổi chỉ áp dụng cho đăng/sửa Feed. Hoạt động đặt lịch và đơn
            hàng tiếp tục theo quyền hiện tại.
          </p>
          {[true, false].map((blocked) => (
            <button
              className="mr-4"
              key={String(blocked)}
              disabled={
                mutation.isPending ||
                note.trim().length < 5 ||
                !/^[a-f0-9-]{36}$/i.test(providerId)
              }
              onClick={() =>
                mutation.mutate({
                  url: `/internal/feed/providers/${providerId}/posting-restriction`,
                  body: { blocked, note: note.trim() },
                })
              }
            >
              {blocked ? "Khóa đăng Feed" : "Mở lại đăng Feed"}
            </button>
          ))}
        </fieldset>
      )}
    </section>
  );
}
