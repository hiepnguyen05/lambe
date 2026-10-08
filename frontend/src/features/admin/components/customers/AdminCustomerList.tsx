import { RefreshCw } from 'lucide-react';
import { useCustomers } from '../../hooks/useCustomers';
import { CustomerStats } from './components/CustomerStats';
import { CustomerFilters } from './components/CustomerFilters';
import { CustomerTable } from './components/CustomerTable';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { useState } from 'react';
import type { AdminCustomer } from '../../hooks/useCustomers';
import { useDialog } from '../../../../components/ui/DialogProvider';

export function AdminCustomerList() {
  const [detailCustomer, setDetailCustomer] = useState<AdminCustomer | null>(null);
  const {
    customers,
    totalCount,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    pagination, setPagination,
    selectedRowIds, handleSelectAll, handleSelectRow,
    isLoading, refetch, error, updateCustomerStatus
  } = useCustomers();

  const { showDialog } = useDialog();

  const handleBulkLock = () => {
    if (selectedRowIds.length === 0) return;
    
    showDialog({
      title: 'Khóa tài khoản hàng loạt',
      message: `Bạn đang chọn khóa ${selectedRowIds.length} khách hàng. Vui lòng nhập lý do khóa:`,
      type: 'warning',
      withInput: true,
      inputPlaceholder: 'Nhập lý do khóa...',
      inputDefaultValue: '',
      inputSuggestions: [
        'Vi phạm chính sách cộng đồng',
        'Nghi ngờ gian lận / Spam',
        'Tài khoản giả mạo',
        'Yêu cầu khóa từ người dùng'
      ],
      confirmText: 'Khóa hàng loạt',
      onConfirm: async (reason) => {
        if (!reason || reason.trim().length < 10) {
          showDialog({ title: 'Lỗi', message: 'Lý do khóa tài khoản phải dài ít nhất 10 ký tự.', type: 'error' });
          return;
        }

        try {
          await Promise.all(selectedRowIds.map(id => updateCustomerStatus(id, 'BLOCKED', reason.trim())));
          handleSelectAll(false);
          showDialog({ title: 'Thành công', message: `Đã khóa thành công ${selectedRowIds.length} khách hàng.`, type: 'success' });
        } catch (err: any) {
          showDialog({ title: 'Lỗi', message: err.message || 'Có lỗi xảy ra khi khóa hàng loạt', type: 'error' });
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              Quản lý khách hàng
            </h1>
            <span className="bg-teal-100 text-[#0f766e] text-xs font-bold px-2.5 py-0.5 rounded-full ring-1 ring-teal-200">
              {totalCount} người dùng
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cơ sở dữ liệu khách hàng Lambe Home Beauty & Spa: hồ sơ và trạng thái hoạt động.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <CustomerStats totalCount={totalCount} />

      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200 text-sm font-medium">
          {error}
        </div>
      )}

      <CustomerFilters 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        limit={pagination.limit}
        setLimit={(limit) => setPagination(prev => ({ ...prev, limit }))}
        setPage={(page) => setPagination(prev => ({ ...prev, page }))}
      />

      {/* Bulk Actions Indicator Bar (Shown when items selected) */}
      {selectedRowIds.length > 0 && (
        <div className="flex items-center justify-between p-2.5 px-4 bg-teal-50 border border-teal-200 rounded-xl text-xs font-medium text-[#0f766e] animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0f766e] text-white flex items-center justify-center font-bold text-[10px]">
              {selectedRowIds.length}
            </span>
            <span>khách hàng đã được chọn trên trang này</span>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-2.5 py-1 text-xs font-semibold bg-white text-[#0f766e] border border-teal-200 rounded-lg hover:bg-teal-100/50 transition cursor-pointer">
              Gửi Voucher / Ưu đãi
            </button>
            <button 
              onClick={handleBulkLock}
              className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition cursor-pointer"
            >
              Khóa hàng loạt
            </button>
            <button 
              onClick={() => handleSelectAll(false)}
              className="text-xs text-slate-500 hover:text-slate-800 underline ml-2 cursor-pointer"
            >
              Hủy chọn
            </button>
          </div>
        </div>
      )}

      <CustomerTable 
        customers={customers}
        isLoading={isLoading}
        selectedRowIds={selectedRowIds}
        handleSelectAll={handleSelectAll}
        handleSelectRow={handleSelectRow}
        updateCustomerStatus={updateCustomerStatus}
        onViewDetail={setDetailCustomer}
      />

      {detailCustomer && (
        <CustomerDetailModal 
          customer={detailCustomer} 
          onClose={() => setDetailCustomer(null)} 
        />
      )}
    </div>
  );
}
