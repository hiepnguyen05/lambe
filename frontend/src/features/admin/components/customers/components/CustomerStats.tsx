import { Users, UserCheck, ShieldAlert, Sparkles } from 'lucide-react';

interface CustomerStatsProps {
  totalCount: number;
}

export function CustomerStats({ totalCount }: CustomerStatsProps) {
  // Vì backend chưa có API trả về các thống kê chi tiết (chưa được phát triển), 
  // các dữ liệu như tăng trưởng, số khách hoạt động, bị khóa dưới đây được tính tương đối hoặc mock tạm thời
  // để hoàn thiện giao diện dựa trên tổng số thực tế.
  const activeEstimate = Math.floor(totalCount * 0.93);
  const blockedEstimate = Math.floor(totalCount * 0.02);

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
              {totalCount.toLocaleString('vi-VN')}
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
              {activeEstimate.toLocaleString('vi-VN')}
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
              {blockedEstimate.toLocaleString('vi-VN')}
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
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Khách mới HN</div>
            <div className="text-lg font-extrabold text-[#0f766e] leading-tight">+0</div>
          </div>
        </div>
      </div>
    </div>
  );
}
