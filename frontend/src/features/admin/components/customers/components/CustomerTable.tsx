import type { AdminCustomer } from '../../../hooks/useCustomers';
import { Eye, Lock, Unlock } from 'lucide-react';
import { useDialog } from '../../../../../components/ui/DialogProvider';

interface CustomerTableProps {
  customers: AdminCustomer[];
  isLoading: boolean;
  selectedRowIds: string[];
  handleSelectAll: (checked: boolean) => void;
  handleSelectRow: (id: string) => void;
  updateCustomerStatus: (id: string, status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED', reason?: string) => Promise<boolean>;
  onViewDetail: (customer: AdminCustomer) => void;
}

export function CustomerTable({ customers, isLoading, selectedRowIds, handleSelectAll, handleSelectRow, updateCustomerStatus, onViewDetail }: CustomerTableProps) {
  const { showDialog } = useDialog();

  const handleUpdateStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED') => {
    if (status === 'BLOCKED') {
      showDialog({
        title: 'Khóa tài khoản',
        message: 'Vui lòng nhập lý do khóa tài khoản này:',
        type: 'warning',
        withInput: true,
        inputPlaceholder: 'Nhập lý do...',
        inputDefaultValue: '',
        inputSuggestions: [
          'Vi phạm chính sách cộng đồng',
          'Nghi ngờ gian lận / Spam',
          'Tài khoản giả mạo',
          'Yêu cầu khóa từ người dùng'
        ],
        confirmText: 'Khóa tài khoản',
        onConfirm: async (reason) => {
          if (!reason || reason.trim().length < 10) {
            showDialog({ title: 'Lỗi', message: 'Lý do khóa tài khoản phải dài ít nhất 10 ký tự.', type: 'error' });
            return;
          }
          try {
            await updateCustomerStatus(id, status, reason.trim());
            showDialog({ title: 'Thành công', message: 'Đã khóa tài khoản thành công', type: 'success' });
          } catch (err: any) {
            showDialog({ title: 'Lỗi', message: err.message || 'Lỗi cập nhật trạng thái', type: 'error' });
          }
        }
      });
    } else {
      try {
        await updateCustomerStatus(id, status);
        showDialog({ title: 'Thành công', message: 'Cập nhật trạng thái thành công', type: 'success' });
      } catch (err: any) {
        showDialog({ title: 'Lỗi', message: err.message || 'Lỗi cập nhật trạng thái', type: 'error' });
      }
    }
  };
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-card overflow-hidden flex flex-col">
      <div className="overflow-x-auto min-h-[420px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
              <th className="py-3.5 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={customers.length > 0 && customers.every(c => selectedRowIds.includes(c.id))}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-slate-300 text-[#0f766e] focus:ring-[#0f766e] cursor-pointer"
                />
              </th>
              <th className="py-3.5 px-4">Khách hàng</th>
              <th className="py-3.5 px-4">Thông tin liên hệ</th>
              <th className="py-3.5 px-4">Hồ sơ khách hàng</th>
              <th className="py-3.5 px-4">Trạng thái</th>
              <th className="py-3.5 px-5 text-right">Tác vụ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">Đang tải dữ liệu...</td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">Không tìm thấy khách hàng nào</td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition cursor-pointer group">
                  <td className="py-4 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRowIds.includes(c.id)}
                      onChange={() => handleSelectRow(c.id)}
                      className="rounded border-slate-300 text-[#0f766e] focus:ring-[#0f766e] cursor-pointer"
                    />
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.fullName || 'Khách hàng'} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-[#0f766e] font-bold text-sm">
                          {(c.fullName || c.phone || 'K').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900">{c.fullName || 'Chưa cập nhật'}</div>
                        <div className="text-[11px] font-medium text-slate-500 mt-0.5">Tham gia: {new Date(c.createdAt).toLocaleDateString('vi-VN')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-slate-700 font-bold">{c.phone}</div>
                    <div className="text-slate-500 mt-0.5">{c.roles.join(', ')}</div>
                  </td>
                  <td className="py-4 px-4">
                    {c.customerProfile ? (
                      <>
                        <div className="font-semibold text-slate-900">
                          {c.customerProfile.gender === 'MALE' ? 'Nam' : c.customerProfile.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
                        </div>
                        <div className="text-slate-500 mt-0.5 text-[11px]">
                          Onboarding: {c.customerProfile.onboardingStatus}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Chưa có hồ sơ</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {c.status === 'ACTIVE' && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-semibold border border-emerald-200">Hoạt động</span>}
                    {c.status === 'BLOCKED' && <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg font-semibold border border-rose-200">Bị khóa</span>}
                    {c.status === 'INACTIVE' && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg font-semibold border border-amber-200">Tạm vô hiệu</span>}
                  </td>
                  <td className="py-4 px-5 align-middle text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {c.status === 'ACTIVE' ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(c.id, 'BLOCKED'); }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" 
                          title="Khóa tài khoản"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(c.id, 'ACTIVE'); }}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" 
                          title="Mở khóa tài khoản"
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); onViewDetail(c); }}
                        className="p-2 text-slate-400 hover:text-[#0f766e] hover:bg-teal-50 rounded-lg transition" 
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
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
