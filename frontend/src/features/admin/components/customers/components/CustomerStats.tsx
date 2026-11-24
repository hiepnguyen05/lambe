import { Users, UserCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../../../lib/api-client';

interface CountResponse {
  meta?: { total?: number };
}

export function CustomerStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-customer-summary'],
    queryFn: async () => {
      const paths = [
        '/admin/customers?page=1&limit=1',
        '/admin/customers?status=ACTIVE&page=1&limit=1',
        '/admin/customers?status=BLOCKED&page=1&limit=1',
        '/admin/customers?status=INACTIVE&page=1&limit=1',
      ];
      const [total, active, blocked, inactive] = await Promise.all(
        paths.map((path) => apiRequest<CountResponse>(path)),
      );
      return {
        total: total.meta?.total ?? 0,
        active: active.meta?.total ?? 0,
        blocked: blocked.meta?.total ?? 0,
        inactive: inactive.meta?.total ?? 0,
      };
    },
    staleTime: 30_000,
  });

  const value = (key: keyof NonNullable<typeof data>) =>
    isLoading || !data ? '—' : data[key].toLocaleString('vi-VN');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Stat 1: Total Customers */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-[#0f766e] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng khách hàng</div>
            <div className="text-lg font-extrabold text-slate-900 leading-tight">
              {value('total')}
            </div>
          </div>
        </div>
      </div>

      {/* Stat 2: Active Accounts */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đang hoạt động</div>
            <div className="text-lg font-extrabold text-slate-900 leading-tight">
              {value('active')}
            </div>
          </div>
        </div>
      </div>

      {/* Stat 3: Blocked / Flagged */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tài khoản khóa</div>
            <div className="text-lg font-extrabold text-rose-600 leading-tight">
              {value('blocked')}
            </div>
          </div>
        </div>
      </div>

      {/* Stat 4: New Today */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-[#0f766e] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tạm vô hiệu</div>
            <div className="text-lg font-extrabold text-[#0f766e] leading-tight">{value('inactive')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
