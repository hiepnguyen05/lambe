import { useState } from 'react';
import { canAccessFeature } from '../../auth/admin-permissions';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useDashboardAnalytics } from '../../hooks/useDashboardAnalytics';
import type { DashboardPeriod } from '../../types/dashboard-analytics.types';
import { FeedCachePanel } from '../feed/FeedCachePanel';
import { DashboardFilterBar } from './components/DashboardFilterBar';
import { DashboardKpiCards } from './components/DashboardKpiCards';
import { OperationalAlertsTable } from './components/OperationalAlertsTable';
import { OrderStatusDonutChart } from './components/OrderStatusDonutChart';
import { RevenueTrendChart } from './components/RevenueTrendChart';
import { TopCategoriesBarChart } from './components/TopCategoriesBarChart';
import { UserGrowthChart } from './components/UserGrowthChart';

export function AdminDashboard() {
  const { account } = useAdminAuth();
  const roles = account?.roles;
  const [period, setPeriod] = useState<DashboardPeriod>('7d');

  const canReadOrders = canAccessFeature(roles, 'orders');
  const canReadAlerts = canAccessFeature(roles, 'orderAlerts');
  const canManageFeed = canAccessFeature(roles, 'feedModeration');

  const { data, isLoading, isError, refetch } = useDashboardAnalytics(period, canReadOrders);

  const handleExportCsv = () => {
    const kpis = data.kpis;
    const csvContent = [
      'Chỉ số,Giá trị',
      `Tổng doanh thu (GMV),${kpis.gmv}`,
      `Tổng đơn đặt lịch,${kpis.totalBookings}`,
      `Tỷ lệ hoàn thành,${kpis.completionRate}%`,
      `Đối tác hoạt động,${kpis.activeProviders}`,
      `Cảnh báo khẩn cấp,${kpis.urgentAlertsCount}`,
      '',
      'Ngày,Doanh thu (VND),Lượng đơn',
      ...data.revenueTrend.map((p) => `${p.date},${p.revenue},${p.orders}`),
      '',
      'Trạng thái,Số lượng,Tỷ lệ (%)',
      ...data.statusDistribution.map((s) => `${s.label},${s.count},${s.percentage}%`),
    ].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lambe-analytics-report-${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Tổng quan hệ thống</h1>
        <p className="text-sm text-slate-500">
          Chỉ số hiệu suất kinh doanh, luồng vận hành dịch vụ và cảnh báo thời gian thực của nền tảng Lambe.
        </p>
      </div>

      {/* Filter & Control Bar */}
      <DashboardFilterBar
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={refetch}
        isLoading={isLoading}
        onExportCsv={handleExportCsv}
      />

      {/* Warning message if query fails */}
      {isError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Một phần dữ liệu thống kê chưa tải được. Hệ thống đang hiển thị dữ liệu cục bộ mới nhất.
        </div>
      )}

      {/* Top 5 KPI Metrics */}
      <DashboardKpiCards kpis={data.kpis} isLoading={isLoading} />

      {/* Main Charts: Revenue Trend & Order Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <RevenueTrendChart data={data.revenueTrend} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-4">
          <OrderStatusDonutChart data={data.statusDistribution} isLoading={isLoading} />
        </div>
      </div>

      {/* Secondary Charts: Top Categories & User Growth */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TopCategoriesBarChart data={data.categoryBreakdown} isLoading={isLoading} />
        <UserGrowthChart data={data.growthTrend} isLoading={isLoading} />
      </div>

      {/* Operational Alerts & Incident Queue */}
      {canReadAlerts && (
        <OperationalAlertsTable alerts={data.recentAlerts} isLoading={isLoading} />
      )}

      {/* Feed Cache & System Tuning Panel */}
      {canManageFeed && (
        <div className="pt-2">
          <div className="mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Quản trị kỹ thuật</h3>
          </div>
          <FeedCachePanel />
        </div>
      )}
    </div>
  );
}
