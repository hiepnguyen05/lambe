import { Download, RefreshCw } from 'lucide-react';
import type { DashboardPeriod } from '../../../types/dashboard-analytics.types';

interface DashboardFilterBarProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  onRefresh: () => void;
  isLoading: boolean;
  onExportCsv: () => void;
}

const PERIOD_OPTIONS: Array<{ key: DashboardPeriod; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày qua' },
  { key: '30d', label: '30 ngày qua' },
  { key: 'month', label: 'Tháng này' },
];

export function DashboardFilterBar({
  period,
  onPeriodChange,
  onRefresh,
  isLoading,
  onExportCsv,
}: DashboardFilterBarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
      {/* Time Period Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl w-fit">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onPeriodChange(opt.key)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              period === opt.key
                ? 'bg-white text-teal-800 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onExportCsv}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          title="Xuất dữ liệu báo cáo"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          <span>Xuất báo cáo</span>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-3.5 py-2 text-xs font-semibold transition-all disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
        </button>
      </div>
    </div>
  );
}

