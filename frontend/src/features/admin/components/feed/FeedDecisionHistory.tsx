import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../../../lib/api-client";
import { useAdminAuth } from "../../hooks/useAdminAuth";
export function FeedDecisionHistory({ postId }: { postId: string }) {
  const { account } = useAdminAuth();
  const query = useQuery({
    queryKey: ["feed-review-history", account?.id, postId],
    queryFn: () =>
      apiRequest<{
        data: {
          data: {
            id: string;
            revisionNumber: number;
            status: string;
            recommendationStatus: string;
            policyCode: string | null;
            note: string | null;
            source: string;
            createdAt: string;
          }[];
        };
      }>(`/internal/feed/posts/${postId}/review-history`),
  });
  return (
    <section className="space-y-2">
      <h4 className="font-semibold">Lịch sử kiểm duyệt</h4>
      {query.isLoading ? (
        <p>Đang tải…</p>
      ) : query.isError ? (
        <p role="alert">
          Không tải được lịch sử.{" "}
          <button onClick={() => void query.refetch()}>Thử lại</button>
        </p>
      ) : query.data?.data.data.length === 0 ? (
        <p>Chưa có quyết định.</p>
      ) : (
        query.data?.data.data.map((d) => (
          <div key={d.id} className="rounded border p-3 text-sm">
            <p>
              Phiên bản {d.revisionNumber} · {d.status} ·{" "}
              {d.recommendationStatus}
            </p>
            <p>
              {d.policyCode} · {d.note}
            </p>
            <p>
              {d.source} · {new Date(d.createdAt).toLocaleString("vi-VN")}
            </p>
          </div>
        ))
      )}
    </section>
  );
}
