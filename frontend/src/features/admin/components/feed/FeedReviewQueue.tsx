import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../../lib/api-client";

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
const policies = [
  "SEXUAL_OR_NUDITY",
  "PRIVACY_OR_NO_CONSENT",
  "MISLEADING_OR_MEDICAL_CLAIM",
  "SPAM_OR_SCAM",
  "VIOLENCE_OR_GRAPHIC",
  "COPYRIGHT_OR_REUPLOAD",
  "OTHER",
];
const labels = [
  "Nội dung tình dục/khỏa thân",
  "Quyền riêng tư/consent",
  "Thông tin sai lệch/điều trị",
  "Spam/lừa đảo",
  "Bạo lực/hình ảnh ghê rợn",
  "Bản quyền/đăng lại",
  "Khác",
];
export function FeedReviewQueue() {
  const client = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>();
  const [selected, setSelected] = useState<Post | null>(null);
  const [policy, setPolicy] = useState("OTHER");
  const [note, setNote] = useState("");
  const [eligible, setEligible] = useState(true);
  const [blockMedia, setBlockMedia] = useState(false);
  const queue = useQuery({
    queryKey: ["feed-review-queue", cursor],
    queryFn: () =>
      apiRequest<{ data: { data: Post[]; nextCursor: string | null } }>(
        `/internal/feed/review-queue?limit=10${cursor ? `&cursor=${cursor}` : ""}`,
      ),
  });
  const appeals = useQuery({
    queryKey: ["feed-review-appeals"],
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
      }>("/internal/feed/appeals"),
  });
  const history = useQuery({
    queryKey: ["feed-review-history", selected?.id],
    enabled: !!selected,
    queryFn: () =>
      apiRequest<{
        data: {
          data: {
            id: string;
            status: string;
            source: string;
            note: string | null;
          }[];
        };
      }>(`/internal/feed/posts/${selected!.id}/review-history`),
  });
  const mutation = useMutation({
    mutationFn: async ({ url, body }: { url: string; body: unknown }) =>
      apiRequest(url, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      setSelected(null);
      setNote("");
      void client.invalidateQueries({ queryKey: ["feed-review-queue"] });
      void client.invalidateQueries({ queryKey: ["feed-review-appeals"] });
      void client.invalidateQueries({ queryKey: ["admin-feed-posts"] });
      void client.invalidateQueries({ queryKey: ["admin-feed-stats"] });
    },
  });
  const decide = (decision: "APPROVED" | "REJECTED") => {
    if (!selected) return;
    mutation.mutate({
      url: `/internal/feed/posts/${selected.id}/review`,
      body: {
        revisionNumber: selected.revisionNumber,
        decision,
        eligible: decision === "APPROVED" && eligible,
        blockMedia: decision === "REJECTED" && blockMedia,
        ...((decision === "REJECTED" || !eligible) && {
          policyCode: policy,
          note: note.trim(),
        }),
      },
    });
  };
  return (
    <section className="space-y-4 rounded-xl bg-white p-5">
      <h2 className="text-xl font-semibold">Chờ kiểm duyệt nền tảng</h2>
      <p>
        Bài chỉ công khai khi được nền tảng duyệt và đáp ứng điều kiện của tổ
        chức. Xem đầy đủ ảnh/video trước khi quyết định.
      </p>
      {queue.isError && (
        <p role="alert">
          Không tải được hàng chờ.{" "}
          <button onClick={() => void queue.refetch()}>Thử lại</button>
        </p>
      )}
      {mutation.isError && (
        <p role="alert">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Không thể lưu quyết định. Hãy tải lại phiên bản mới."}
        </p>
      )}
      {queue.isLoading ? (
        <p>Đang tải…</p>
      ) : queue.data?.data.data.length === 0 ? (
        <p>Không có bài chờ duyệt.</p>
      ) : (
        queue.data?.data.data.map((post) => (
          <button
            className="block w-full rounded border p-3 text-left"
            key={post.id}
            onClick={() => {
              setSelected(post);
              setNote("");
              setEligible(true);
              setBlockMedia(false);
              mutation.reset();
            }}
          >
            {post.provider.displayName} — {post.caption} (phiên bản{" "}
            {post.revisionNumber})
            <span className="block text-sm">
              Rủi ro: {post.safetyScore} · Báo cáo: {post.reports} · Tương tác:{" "}
              {post.engagements}
            </span>
          </button>
        ))
      )}
      <div className="flex gap-4">
        <button
          onClick={() => {
            setCursor(undefined);
            void queue.refetch();
          }}
        >
          Tải lại từ đầu
        </button>
        {queue.data?.data.nextCursor && (
          <button onClick={() => setCursor(queue.data!.data.nextCursor!)}>
            Trang tiếp
          </button>
        )}
      </div>
      {selected && (
        <div className="space-y-3 rounded border p-4">
          <h3 className="font-semibold">{selected.provider.displayName}</h3>
          <p className="whitespace-pre-wrap">{selected.caption}</p>
          <p>
            Dịch vụ gắn bài:{" "}
            {selected.services
              ?.map((link) => link.providerService.service.name)
              .join(", ") || "Không có dịch vụ còn hiển thị"}
          </p>
          <p>
            Tín hiệu hỗ trợ:{" "}
            {selected.safetyLabels?.join(", ") || "Chưa có tín hiệu"}. Cần kiểm
            tra nội dung và ngữ cảnh trước khi quyết định.
          </p>
          <p>
            Có khách hàng: {selected.includesCustomer ? "Có" : "Không"} · Xác
            nhận consent: {selected.hasCustomerConsent ? "Có" : "Không"}
          </p>
          <div className="flex flex-wrap gap-3">
            {selected.media.map((m) =>
              m.kind === "VIDEO" ? (
                <video
                  key={m.id}
                  controls
                  preload="metadata"
                  src={m.url}
                  className="max-h-80 max-w-full"
                />
              ) : (
                <img
                  key={m.id}
                  src={m.url}
                  alt="Ảnh bài chờ duyệt"
                  className="max-h-80 max-w-full"
                />
              ),
            )}
          </div>
          <label className="block">
            <input
              type="checkbox"
              checked={blockMedia}
              onChange={(e) => setBlockMedia(e.target.checked)}
            />{" "}
            Chặn tải lại media này nếu từ chối (chỉ chọn khi chính media vi
            phạm)
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={eligible}
              onChange={(e) => setEligible(e.target.checked)}
            />{" "}
            Cho phép xuất hiện trong gợi ý khi duyệt
          </label>
          <label className="block">
            Chính sách{" "}
            <select value={policy} onChange={(e) => setPolicy(e.target.value)}>
              {policies.map((p, i) => (
                <option key={p} value={p}>
                  {labels[i]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Lý do (bắt buộc khi từ chối/hạn chế)
            <textarea
              className="block w-full border p-2"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="flex gap-4">
            <button
              disabled={
                mutation.isPending || (!eligible && note.trim().length < 5)
              }
              onClick={() => decide("APPROVED")}
            >
              Duyệt bài
            </button>
            <button
              disabled={mutation.isPending || note.trim().length < 5}
              onClick={() => decide("REJECTED")}
            >
              Từ chối
            </button>
            <button onClick={() => setSelected(null)}>Đóng</button>
          </div>
          <details>
            <summary>Lịch sử quyết định</summary>
            {history.isError ? (
              <p>Không tải được lịch sử.</p>
            ) : (
              history.data?.data.data.map((d) => (
                <p key={d.id}>
                  {d.status} · {d.source} · {d.note}
                </p>
              ))
            )}
          </details>
        </div>
      )}
      <h2 className="text-xl font-semibold">Khiếu nại chờ xử lý</h2>
      <p>
        Nhập lý do ít nhất 5 ký tự ở ô trên trước khi xử lý. Người ra quyết định
        đầu không được xét khiếu nại.
      </p>
      {!selected && (
        <textarea
          aria-label="Lý do xử lý khiếu nại"
          className="block w-full border p-2"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}
      {appeals.isError && <p role="alert">Không tải được khiếu nại.</p>}
      {appeals.data?.data.data.map((a) => (
        <div className="rounded border p-3" key={a.id}>
          <p>{a.post.caption}</p>
          <p>Quyết định trước: {a.post.moderationNote}</p>
          <p>Khiếu nại: {a.reason}</p>
          <div className="flex flex-wrap gap-3">
            {a.post.media.map((m) =>
              m.kind === "VIDEO" ? (
                <video
                  key={m.id}
                  controls
                  preload="metadata"
                  src={m.secureUrl}
                  className="max-h-80 max-w-full"
                />
              ) : (
                <img
                  key={m.id}
                  src={m.secureUrl}
                  alt="Nội dung khiếu nại"
                  className="max-h-80 max-w-full"
                />
              ),
            )}
          </div>
          {(["UPHELD", "REVERSED"] as const).map((d) => (
            <button
              className="mr-4"
              key={d}
              disabled={mutation.isPending || note.trim().length < 5}
              onClick={() =>
                mutation.mutate({
                  url: `/internal/feed/appeals/${a.id}`,
                  body: { decision: d, note: note.trim() },
                })
              }
            >
              {d === "UPHELD" ? "Giữ quyết định" : "Chấp nhận khiếu nại"}
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
