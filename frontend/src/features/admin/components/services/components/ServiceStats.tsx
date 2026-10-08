import { Briefcase, CheckCircle, Clock, ShieldAlert } from 'lucide-react';
import type { AdminService } from '../../../hooks/useAdminServices';

interface ServiceStatsProps {
  totalCount: number;
  services: AdminService[];
}

export function ServiceStats({ totalCount, services }: ServiceStatsProps) {
  // Vì không có API thống kê tổng quan, mình sẽ tính toán tạm trên danh sách hiện tại
  // để giao diện sinh động hơn
  const activeCount = services.filter(s => s.status === 'ACTIVE').length;
  const archivedCount = services.filter(s => s.status === 'ARCHIVED').length;
  const requireCertCount = services.filter(s => s.requiresCertificate).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total Services */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-[#0f766e] flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng dịch vụ</div>
            <div className="text-lg font-extrabold text-slate-900 leading-tight">{totalCount}</div>
          </div>
        </div>
      </div>

      {/* Active Services */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hoạt động (Trang này)</div>
            <div className="text-lg font-extrabold text-slate-900 leading-tight">{activeCount}+</div>
          </div>
        </div>
      </div>

      {/* Need Cert */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Yêu cầu CC</div>
            <div className="text-lg font-extrabold text-slate-900 leading-tight">{requireCertCount}</div>
          </div>
        </div>
      </div>

      {/* Archived */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lưu trữ</div>
            <div className="text-lg font-extrabold text-slate-900 leading-tight">{archivedCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
