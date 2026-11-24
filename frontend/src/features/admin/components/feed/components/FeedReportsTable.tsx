import type { AdminFeedReportItem } from '../types';
import { REASON_LABELS } from '../types';
import { formatDate } from '../../../../../lib/formatters';

interface FeedReportsTableProps {
  reports: AdminFeedReportItem[];
  reportReviewed: boolean;
  onResolveReport: (report: AdminFeedReportItem, resolution: 'DISMISSED' | 'POST_HIDDEN') => void;
}

export function FeedReportsTable({
  reports,
  reportReviewed,
  onResolveReport,
}: FeedReportsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
      <div className="overflow-x-auto min-h-[360px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
              <th className="py-3.5 px-4">Lý do & Nội dung báo cáo</th>
              <th className="py-3.5 px-4">Bài viết bị phản ánh</th>
              <th className="py-3.5 px-4">Người báo cáo</th>
              <th className="py-3.5 px-4">Thời gian</th>
              <th className="py-3.5 px-4 text-center">Trạng thái bài</th>
              <th className="py-3.5 px-4 text-center">Kết quả</th>
              <th className="py-3.5 px-5 text-right">Tác vụ xử lý</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {reports.map((report) => {
              const reasonMeta = REASON_LABELS[report.reason] || {
                label: report.reason,
                badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
              };
              const firstMedia = report.post.media[0];

              return (
                <tr key={report.id} className="hover:bg-slate-50/80 transition">
                  {/* Reason & Detail */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${reasonMeta.badgeClass}`}
                    >
                      {reasonMeta.label}
                    </span>
                    {report.detail && (
                      <p className="mt-1.5 text-xs text-slate-700 italic bg-amber-50/60 border border-amber-200/60 rounded-lg p-2">
                        "{report.detail}"
                      </p>
                    )}
                  </td>

                  {/* Post info */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                        {firstMedia ? (
                          <img
                            src={firstMedia.secureUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                            Không ảnh
                          </div>
                        )}
                      </div>
                      <div className="max-w-xs">
                        <p className="line-clamp-2 text-xs font-medium text-slate-900">
                          {report.post.caption || <span className="italic text-slate-400">Không có mô tả</span>}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Bài #{report.post.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Reporter */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-800">
                      {report.user?.fullName || 'Người dùng ẩn danh'}
                    </div>
                    {report.user?.phone && (
                      <div className="text-[11px] text-slate-400">{report.user.phone}</div>
                    )}
                  </td>

                  {/* Created date */}
                  <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                    {formatDate(report.createdAt)}
                  </td>

                  {/* Post status */}
                  <td className="py-3.5 px-4 text-center">
                    {report.post.status === 'HIDDEN' ? (
                      <span className="inline-flex items-center rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                        Đã ẩn
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                        Đang hiện
                      </span>
                    )}
                  </td>

                  {/* Resolution */}
                  <td className="py-3.5 px-4 text-center">
                    {report.resolution ? (
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            report.resolution === 'POST_HIDDEN' || report.resolution === 'CONTENT_REMOVED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {report.resolution === 'POST_HIDDEN' || report.resolution === 'CONTENT_REMOVED' ? 'Đã ẩn/rút bài' : report.resolution === 'CONTENT_RESTRICTED' ? 'Đã hạn chế gợi ý' : 'Không vi phạm'}
                        </span>
                        {report.reviewedBy && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            bởi {report.reviewedBy.fullName || report.reviewedBy.username}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        Chờ duyệt
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-5 text-right">
                    {!reportReviewed ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onResolveReport(report, 'DISMISSED')}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Bỏ qua
                        </button>
                        <button
                          type="button"
                          onClick={() => onResolveReport(report, 'POST_HIDDEN')}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          Ẩn bài & Xử lý
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Đã giải quyết</span>
                    )}
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

