import { Lock, Unlock, Edit3, ImagePlus, ShieldAlert } from 'lucide-react';
import type { AdminService } from '../../../hooks/useAdminServices';

interface ServiceTableProps {
  services: AdminService[];
  isLoading: boolean;
  onEdit: (service: AdminService) => void;
  onStatusChange: (id: string, status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') => void;
}

export function ServiceTable({ services, isLoading, onEdit, onStatusChange }: ServiceTableProps) {
  const getAudienceLabel = (audience: string) => {
    if (audience === 'MEN') return 'Nam';
    if (audience === 'WOMEN') return 'Nữ';
    return 'Tất cả';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-semibold border border-emerald-200">Hoạt động</span>;
      case 'INACTIVE':
        return <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg font-semibold border border-rose-200">Khóa tạm</span>;
      case 'ARCHIVED':
        return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-semibold border border-slate-200">Lưu trữ</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-semibold">{status}</span>;
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-card overflow-hidden flex flex-col">
      <div className="overflow-x-auto min-h-[420px]">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
              <th className="py-3.5 px-4">Dịch vụ</th>
              <th className="py-3.5 px-4">Danh mục & Đối tượng</th>
              <th className="py-3.5 px-4">Khung giá & Thời lượng</th>
              <th className="py-3.5 px-4">Yêu cầu đối tác</th>
              <th className="py-3.5 px-4">Trạng thái</th>
              <th className="py-3.5 px-5 text-right w-[140px]">Tác vụ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">Đang tải dữ liệu...</td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-4xl text-slate-300">search_off</span>
                  <span>Không tìm thấy dịch vụ nào</span>
                </td>
              </tr>
            ) : (
              services.map((service) => (
                <tr key={service.id} className="hover:bg-slate-50 transition">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl border border-teal-100 flex-shrink-0 overflow-hidden bg-teal-50 text-[#0f766e] flex items-center justify-center">
                        {service.iconUrl ? (
                          <span className="material-symbols-outlined text-2xl">{service.iconUrl}</span>
                        ) : (
                          <span className="material-symbols-outlined text-2xl text-teal-300">category</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate" title={service.name}>{service.name}</div>
                        <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono border border-slate-200">
                            {service.code}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-700">{service.category?.name || 'Không rõ'}</div>
                    <div className="text-slate-500 mt-0.5 text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">group</span>
                      {getAudienceLabel(service.targetAudience)}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-[#0f766e]">
                      {service.minPriceAmount.toLocaleString('vi-VN')} - {service.maxPriceAmount.toLocaleString('vi-VN')} đ
                    </div>
                    <div className="text-slate-500 mt-0.5 text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">timer</span>
                      {service.defaultDurationMinutes || '--'} phút
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                      {service.requiresCertificate ? (
                        <div className="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 w-max">
                          <ShieldAlert className="w-3 h-3" /> Cần chứng chỉ
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-slate-500">
                          <span className="material-symbols-outlined text-[14px]">verified</span> Không bắt buộc
                        </div>
                      )}
                      {(service.minExperienceYears > 0 || service.minPortfolioImages > 0) && (
                        <div className="text-slate-500">
                          {service.minExperienceYears > 0 ? `${service.minExperienceYears} năm kinh nghiệm` : ''}
                          {service.minExperienceYears > 0 && service.minPortfolioImages > 0 ? ' • ' : ''}
                          {service.minPortfolioImages > 0 ? `${service.minPortfolioImages} ảnh mẫu` : ''}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {getStatusBadge(service.status)}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Image Upload Button (Handled via Edit Modal for now, or direct if needed) */}
                      <button 
                        onClick={() => onEdit(service)}
                        className="p-1.5 text-slate-400 hover:text-[#0f766e] hover:bg-teal-50 rounded-lg transition"
                        title="Tải ảnh bìa"
                      >
                        <ImagePlus className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => onEdit(service)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Chỉnh sửa"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      
                      {service.status === 'ACTIVE' ? (
                        <button 
                          onClick={() => onStatusChange(service.id, 'INACTIVE')}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Tạm khóa"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => onStatusChange(service.id, 'ACTIVE')}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Kích hoạt"
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
