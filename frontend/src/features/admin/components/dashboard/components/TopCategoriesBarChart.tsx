import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CategoryBreakdown } from '../../../types/dashboard-analytics.types';

interface TopCategoriesBarChartProps {
  data: CategoryBreakdown[];
  isLoading?: boolean;
}

export function TopCategoriesBarChart({ data, isLoading }: TopCategoriesBarChartProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <div>
        <h2 className="text-base font-bold text-slate-900">Dịch vụ & Danh mục hàng đầu</h2>
        <p className="mt-0.5 text-xs text-slate-500">Xếp theo số lượt đặt lịch và doanh số</p>
      </div>

      <div className="mt-6 h-64 w-full">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            Chưa có thông tin danh mục dịch vụ
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                axisLine={false}
                width={110}
                tick={{ fill: '#334155', fontSize: 11, fontWeight: 500 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as CategoryBreakdown;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur-xs">
                        <p className="text-xs font-bold text-slate-800">{item.name}</p>
                        <p className="mt-1 text-xs text-teal-800 font-semibold">
                          Lượt đặt: {item.orders} ({item.percentage}%)
                        </p>
                        {item.revenue > 0 && (
                          <p className="mt-0.5 text-xs text-slate-600">
                            Doanh thu: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.revenue)}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="orders" name="Số lượt đặt" fill="#0f766e" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdown progress list */}
      <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-3">
        {data.map((cat, idx) => (
          <div key={cat.name} className="flex items-center justify-between text-xs">
            <span className="truncate text-slate-600 font-medium">
              <span className="font-bold text-slate-400 mr-1.5">#{idx + 1}</span> {cat.name}
            </span>
            <span className="font-semibold text-slate-800 shrink-0">{cat.orders} đơn</span>
          </div>
        ))}
      </div>
    </div>
  );
}

