import { X } from 'lucide-react';
import type { AdminCustomer } from '../../../hooks/useCustomers';

interface CustomerDetailModalProps {
  customer: AdminCustomer;
  onClose: () => void;
}

export function CustomerDetailModal({ customer, onClose }: CustomerDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      ></div>
      
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-elevated flex flex-col animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="font-bold text-lg text-slate-800">Chi tiết khách hàng</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-shrink-0">
              {customer.avatarUrl ? (
                <img src={customer.avatarUrl} alt={customer.fullName || 'Khách hàng'} className="w-24 h-24 rounded-full object-cover shadow-sm border-2 border-white ring-2 ring-teal-100" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-teal-50 flex items-center justify-center text-[#0f766e] font-bold text-3xl shadow-sm border-2 border-white ring-2 ring-teal-100">
                  {(customer.fullName || customer.phone || 'K').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-bold text-slate-900">{customer.fullName || 'Chưa cập nhật tên'}</h3>
              <p className="text-slate-500 font-medium">{customer.phone}</p>
              <div className="flex items-center gap-2 mt-2">
                {customer.status === 'ACTIVE' && <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200">Hoạt động</span>}
                {customer.status === 'BLOCKED' && <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold border border-rose-200">Bị khóa</span>}
                {customer.status === 'INACTIVE' && <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold border border-amber-200">Tạm vô hiệu</span>}
                
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200">
                  ID: {customer.id.substring(0, 8)}...
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <h4 className="font-bold text-sm text-slate-900 mb-3 uppercase tracking-wider">Hồ sơ Onboarding</h4>
            {customer.customerProfile ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Giới tính: </span>
                  <span className="font-semibold text-slate-800">
                    {customer.customerProfile.gender === 'MALE' ? 'Nam' : customer.customerProfile.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Trạng thái Onboarding: </span>
                  <span className="font-semibold text-slate-800">{customer.customerProfile.onboardingStatus}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Khách hàng chưa hoàn thành onboarding.</p>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
             <h4 className="font-bold text-sm text-slate-900 mb-3 uppercase tracking-wider">Thông tin hệ thống</h4>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
               <div>
                  <span className="text-slate-500">Quyền: </span>
                  <span className="font-semibold text-slate-800">{customer.roles.join(', ')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Ngày tham gia: </span>
                  <span className="font-semibold text-slate-800">{new Date(customer.createdAt).toLocaleString('vi-VN')}</span>
                </div>
             </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
