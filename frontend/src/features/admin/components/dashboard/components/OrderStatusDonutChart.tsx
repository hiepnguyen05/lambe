import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { OrderStatusSlice } from '../../../types/dashboard-analytics.types';

interface OrderStatusDonutChartProps {
  data: OrderStatusSlice[];
  isLoading?: boolean;
}

export function OrderStatusDonutChart({ data, isLoading }: OrderStatusDonutChartProps) {
  const totalOrders = data.reduce((acc, curr) => acc + curr.count, 0);

  // If total is 0, provide placeholder slice
  const chartData = totalOrders > 0 ? data : [{ label: 'Chưa có đơn', count: 1, percentage: 100, color: '#e2e8f0', status: 'EMPTY' }];

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <div>
        <h2 className="text-base font-bold text-slate-900">Phân bổ trạng thái đơn</h2>
        <p className="mt-0.5 text-xs text-slate-500">Tỷ lệ theo quy trình vận hành dịch vụ</p>
      </div>

      <div className="relative mt-4 flex h-56 w-full items-center justify-center">
        {isLoading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={86}
                  paddingAngle={3}
                  dataKey="count"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as OrderStatusSlice;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-md backdrop-blur-xs">
                          <p className="text-xs font-bold text-slate-800">{item.label}</p>
                          <p className="text-xs font-semibold text-slate-600 mt-1">
                            {item.count} đơn ({item.percentage}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered Total Counter */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-slate-900">{totalOrders}</span>
              <span className="text-[11px] font-medium text-slate-500">Đơn hàng</span>
            </div>
          </>
        )}
      </div>

      {/* Legend list */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
        {data.map((item) => (
          <div key={item.status} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="truncate text-slate-600 font-medium">{item.label}</span>
            </div>
            <span className="font-bold text-slate-800 shrink-0">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

