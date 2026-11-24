import { CheckCircle2, EyeOff, LayoutGrid, ShieldAlert } from 'lucide-react';
import type { FeedStats } from '../types';

interface FeedStatsCardsProps {
  stats: FeedStats | undefined;
  onSelectReportsTab: () => void;
}

export function FeedStatsCards({ stats, onSelectReportsTab }: FeedStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Posts */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Tổng bài trên Feed
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {stats ? stats.totalPosts.toLocaleString('vi-VN') : '—'}
            </div>
            <div className="text-[11px] text-slate-400">
              {stats
                ? `${stats.totalLikes.toLocaleString('vi-VN')} thích · ${stats.totalComments.toLocaleString('vi-VN')} bình luận`
                : 'Đang cập nhật'}
            </div>
          </div>
        </div>
      </div>

      {/* Published Posts */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Đang hiển thị
            </div>
            <div className="text-xl font-extrabold text-emerald-700">
              {stats ? stats.publishedPosts.toLocaleString('vi-VN') : '—'}
            </div>
            <div className="text-[11px] font-medium text-emerald-600">
              Công khai với khách hàng
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Posts */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <EyeOff className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Đã bị ẩn / Tạm khóa
            </div>
            <div className="text-xl font-extrabold text-amber-700">
              {stats ? stats.hiddenPosts.toLocaleString('vi-VN') : '—'}
            </div>
            <div className="text-[11px] font-medium text-amber-600">
              Vi phạm hoặc đối tác ẩn
            </div>
          </div>
        </div>
      </div>

      {/* Pending Reports */}
      <div
        onClick={onSelectReportsTab}
        className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-rose-300 hover:shadow"
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              stats && stats.pendingReports > 0
                ? 'animate-pulse bg-rose-100 text-rose-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Báo cáo chờ xử lý
            </div>
            <div
              className={`text-xl font-extrabold ${
                stats && stats.pendingReports > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {stats ? stats.pendingReports.toLocaleString('vi-VN') : '—'}
            </div>
            <div className="text-[11px] font-medium text-rose-600">
              {stats && stats.pendingReports > 0 ? 'Cần xem xét ngay' : 'Hàng đợi an toàn'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

