import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RevenueTrendPoint } from '../../../types/dashboard-analytics.types';

interface RevenueTrendChartProps {
  data: RevenueTrendPoint[];
  isLoading?: boolean;
}

type ViewMode = 'all' | 'revenue' | 'orders';

function formatCurrencyShort(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return `${val}`;
}

export function RevenueTrendChart({ data, isLoading }: RevenueTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  const totalRevenue = data.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalOrders = data.reduce((acc, curr) => acc + curr.orders, 0);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Xu hướng Doanh thu & Đơn hàng</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tổng: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalRevenue)} • {totalOrders} lượt đặt
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
              viewMode === 'all' ? 'bg-white text-teal-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setViewMode('revenue')}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
              viewMode === 'revenue' ? 'bg-white text-teal-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Doanh thu
          </button>
          <button
            type="button"
            onClick={() => setViewMode('orders')}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
              viewMode === 'orders' ? 'bg-white text-teal-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lượng đơn
          </button>
        </div>
      </div>

      <div className="mt-6 h-72 w-full">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            Chưa có dữ liệu giao dịch trong chu kỳ này
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueTealGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              {(viewMode === 'all' || viewMode === 'revenue') && (
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCurrencyShort}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
              )}
              {(viewMode === 'all' || viewMode === 'orders') && (
                <YAxis
                  yAxisId="right"
                  orientation={viewMode === 'orders' ? 'left' : 'right'}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  allowDecimals={false}
                />
              )}

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const rev = payload.find((p) => p.dataKey === 'revenue')?.value as number | undefined;
                    const ord = payload.find((p) => p.dataKey === 'orders')?.value as number | undefined;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-xs">
                        <p className="text-xs font-bold text-slate-700">{label}</p>
                        <div className="mt-1.5 space-y-1">
                          {rev !== undefined && (
                            <p className="text-xs font-semibold text-teal-800">
                              Doanh thu: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(rev)}
                            </p>
                          )}
                          {ord !== undefined && (
                            <p className="text-xs font-semibold text-amber-700">
                              Đơn đặt lịch: {ord} đơn
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {(viewMode === 'all' || viewMode === 'revenue') && (
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="Doanh thu (VND)"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revenueTealGradient)"
                />
              )}

              {(viewMode === 'all' || viewMode === 'orders') && (
                <Line
                  yAxisId={viewMode === 'orders' ? 'right' : 'right'}
                  type="monotone"
                  dataKey="orders"
                  name="Lượng đơn"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f59e0b' }}
                  activeDot={{ r: 5 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

