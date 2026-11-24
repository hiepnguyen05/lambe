import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { DashboardKpis } from '../../../types/dashboard-analytics.types';

interface DashboardKpiCardsProps {
  kpis: DashboardKpis;
  isLoading?: boolean;
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardKpiCards({ kpis, isLoading }: DashboardKpiCardsProps) {
  const cards = [
    {
      label: 'Tổng doanh thu (GMV)',
      value: formatVnd(kpis.gmv),
      subtext: `${kpis.gmvGrowth >= 0 ? '+' : ''}${kpis.gmvGrowth}% kỳ trước`,
      isPositive: kpis.gmvGrowth >= 0,
      icon: TrendingUp,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      label: 'Tổng đơn đặt lịch',
      value: `${kpis.totalBookings.toLocaleString('vi-VN')} đơn`,
      subtext: `${kpis.bookingGrowth >= 0 ? '+' : ''}${kpis.bookingGrowth}% kỳ trước`,
      isPositive: kpis.bookingGrowth >= 0,
      icon: ClipboardList,
      iconBg: 'bg-teal-50 text-teal-700 border-teal-100',
    },
    {
      label: 'Tỷ lệ hoàn thành',
      value: `${kpis.completionRate}%`,
      subtext: `${kpis.completionRateDelta >= 0 ? '+' : ''}${kpis.completionRateDelta}% kỳ trước`,
      isPositive: kpis.completionRateDelta >= 0,
      icon: CheckCircle2,
      iconBg: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    },
    {
      label: 'Đối tác hoạt động',
      value: `${kpis.activeProviders.toLocaleString('vi-VN')} stylists/salons`,
      subtext: `+${kpis.activeProvidersDelta} đối tác mới`,
      isPositive: true,
      icon: Sparkles,
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
    {
      label: 'Cảnh báo SLA khẩn',
      value: `${kpis.urgentAlertsCount} sự vụ`,
      subtext: kpis.urgentAlertsCount > 0 ? 'Cần xử lý ngay' : 'Hoạt động ổn định',
      isPositive: kpis.urgentAlertsCount === 0,
      isAlert: kpis.urgentAlertsCount > 0,
      icon: AlertTriangle,
      iconBg: kpis.urgentAlertsCount > 0 ? 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse' : 'bg-slate-50 text-slate-500 border-slate-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-md ${
              c.isAlert ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{c.label}</span>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${c.iconBg}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                {isLoading ? (
                  <div className="h-7 w-28 animate-pulse rounded bg-slate-200" />
                ) : (
                  c.value
                )}
              </div>

              <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                {c.isAlert ? (
                  <span className="inline-flex items-center font-semibold text-rose-600">
                    {c.subtext}
                  </span>
                ) : (
                  <>
                    <span
                      className={`inline-flex items-center font-bold ${
                        c.isPositive ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {c.isPositive ? (
                        <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                      )}
                      {c.subtext}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

