import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GrowthTrendPoint } from '../../../types/dashboard-analytics.types';

interface UserGrowthChartProps {
  data: GrowthTrendPoint[];
  isLoading?: boolean;
}

export function UserGrowthChart({ data, isLoading }: UserGrowthChartProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <div>
        <h2 className="text-base font-bold text-slate-900">Tăng trưởng Người dùng & Đối tác</h2>
        <p className="mt-0.5 text-xs text-slate-500">So sánh tốc độ gia nhập của Khách hàng vs Stylist</p>
      </div>

      <div className="mt-6 h-64 w-full">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="period" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur-xs">
                        <p className="text-xs font-bold text-slate-800">{label}</p>
                        <div className="mt-1.5 space-y-1">
                          <p className="text-xs font-semibold text-indigo-600">
                            Khách hàng mới: {payload[0]?.value}
                          </p>
                          <p className="text-xs font-semibold text-teal-800">
                            Đối tác mới: {payload[1]?.value}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                formatter={(value) => (
                  <span className="text-xs font-medium text-slate-600">
                    {value === 'newCustomers' ? 'Khách hàng mới' : 'Đối tác mới'}
                  </span>
                )}
              />
              <Bar dataKey="newCustomers" name="newCustomers" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="newProviders" name="newProviders" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>Tỷ lệ Cung / Cầu bình quân</span>
        <span className="font-bold text-slate-800">1 : 4.5</span>
      </div>
    </div>
  );
}

