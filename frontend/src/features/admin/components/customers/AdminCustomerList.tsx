import { RefreshCw } from 'lucide-react';
import { useCustomers } from '../../hooks/useCustomers';
import { CustomerStats } from './components/CustomerStats';
import { CustomerFilters } from './components/CustomerFilters';
import { CustomerTable } from './components/CustomerTable';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { useState } from 'react';
import type { AdminCustomer } from '../../hooks/useCustomers';
import { useDialog } from '../../../../components/ui/dialog-context';

export function AdminCustomerList() {
  const [detailCustomer, setDetailCustomer] = useState<AdminCustomer | null>(null);
  const {
    customers,
    totalCount,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    genderFilter, setGenderFilter,
    onboardingFilter, setOnboardingFilter,
    providerStatusFilter, setProviderStatusFilter,
    createdFrom, setCreatedFrom,
    createdTo, setCreatedTo,
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
      inputRequired: true,
      inputMinLength: 10,
      inputMaxLength: 500,
      inputPlaceholder: 'Nhập lý do khóa (tối thiểu 10 ký tự)...',
      inputDefaultValue: '',
      inputSuggestions: [
        'Vi phạm chính sách cộng đồng',
        'Nghi ngờ gian lận / Spam',
        'Tài khoản giả mạo',
        'Yêu cầu khóa từ người dùng'
      ],
      confirmText: 'Khóa hàng loạt',
      onConfirm: async (reason) => {
        if (!reason || reason.trim().length < 10) return false;

        const results = await Promise.all(selectedRowIds.map(async (id) => {
          try {
            await updateCustomerStatus(id, 'BLOCKED', reason.trim());
            return { id, success: true as const };
          } catch (error) {
            return { id, success: false as const, message: error instanceof Error ? error.message : 'Không thể cập nhật' };
          }
        }));
        const succeeded = results.filter((result) => result.success).length;
        const failures = results.filter((result) => !result.success);

        handleSelectAll(false);
        await refetch();

        if (failures.length === 0) {
          showDialog({
            title: 'Thành công',
            message: `Đã khóa thành công ${succeeded} khách hàng.`,
            type: 'success'
          });
        } else {
          showDialog({
            title: 'Hoàn tất một phần',
            message: `Đã khóa ${succeeded} khách hàng. Không thể khóa: ${failures.map((item) => `#${item.id.slice(0, 8)} (${item.message})`).join('; ')}.`,
            type: 'warning'
          });
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

      <CustomerStats />

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
        genderFilter={genderFilter}
        setGenderFilter={setGenderFilter}
        onboardingFilter={onboardingFilter}
        setOnboardingFilter={setOnboardingFilter}
        providerStatusFilter={providerStatusFilter}
        setProviderStatusFilter={setProviderStatusFilter}
        createdFrom={createdFrom}
        setCreatedFrom={setCreatedFrom}
        createdTo={createdTo}
        setCreatedTo={setCreatedTo}
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

      {Math.ceil(totalCount / pagination.limit) > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button type="button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Trước</button>
          <span className="text-sm text-slate-500">Trang {pagination.page}/{Math.ceil(totalCount / pagination.limit)}</span>
          <button type="button" disabled={pagination.page >= Math.ceil(totalCount / pagination.limit)} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Sau</button>
        </div>
      )}

      {detailCustomer && (
        <CustomerDetailModal 
          customerId={detailCustomer.id}
          onClose={() => setDetailCustomer(null)} 
        />
      )}
    </div>
  );
}
