import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useAdminServices } from '../../hooks/useAdminServices';
import type { AdminService } from '../../hooks/useAdminServices';
import { ServiceStats } from './components/ServiceStats';
import { ServiceFilters } from './components/ServiceFilters';
import { ServiceTable } from './components/ServiceTable';
import { ServiceFormModal } from './ServiceFormModal';

export function AdminServiceList() {
  const {
    services,
    totalCount,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    targetAudienceFilter, setTargetAudienceFilter,
    pagination, setPagination,
    isLoading, error, refetch,
    createService, updateService, updateStatus,
    uploadCoverImage, removeCoverImage
  } = useAdminServices();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<AdminService | undefined>();

  const handleCreateNew = () => {
    setEditingService(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (service: AdminService) => {
    setEditingService(service);
    setIsModalOpen(true);
  };

  const handleSuccess = async () => {
    await refetch();
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              Quản lý dịch vụ
            </h1>
            <span className="bg-teal-100 text-[#0f766e] text-xs font-bold px-2.5 py-0.5 rounded-full ring-1 ring-teal-200">
              {totalCount} dịch vụ
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý danh sách dịch vụ chuẩn, khung giá và yêu cầu đối với đối tác thợ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
          
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0f766e] hover:bg-teal-800 rounded-xl transition shadow-sm shadow-teal-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo dịch vụ</span>
          </button>
        </div>
      </div>

      <ServiceStats totalCount={totalCount} services={services} />

      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200 text-sm font-medium">
          {error}
        </div>
      )}

      <ServiceFilters 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        targetAudienceFilter={targetAudienceFilter}
        setTargetAudienceFilter={setTargetAudienceFilter}
        limit={pagination.limit}
        setLimit={(limit) => setPagination(prev => ({ ...prev, limit }))}
        setPage={(page) => setPagination(prev => ({ ...prev, page }))}
      />

      <ServiceTable 
        services={services}
        isLoading={isLoading}
        onEdit={handleEdit}
        onStatusChange={updateStatus}
      />

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 border border-slate-200/90 rounded-xl shadow-sm mt-2">
          <div className="flex flex-1 items-center justify-between">
            <div>
              <p className="text-xs text-slate-700">
                Hiển thị <span className="font-bold">{Math.min((pagination.page - 1) * pagination.limit + 1, totalCount)}</span> đến <span className="font-bold">{Math.min(pagination.page * pagination.limit, totalCount)}</span> trong số <span className="font-bold">{totalCount}</span> kết quả
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-1 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 cursor-pointer"
                >
                  <span className="text-xs font-bold px-1">&laquo; Trước</span>
                </button>
                
                {Array.from({ length: Math.ceil(totalCount / pagination.limit) }).map((_, i) => {
                  // Chỉ hiển thị 5 trang gần nhất
                  const totalPages = Math.ceil(totalCount / pagination.limit);
                  if (
                    totalPages > 5 && 
                    i !== 0 && 
                    i !== totalPages - 1 && 
                    Math.abs(i + 1 - pagination.page) > 1
                  ) {
                    if (Math.abs(i + 1 - pagination.page) === 2) {
                      return <span key={i} className="relative inline-flex items-center px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">...</span>;
                    }
                    return null;
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => setPagination(prev => ({ ...prev, page: i + 1 }))}
                      className={`relative inline-flex items-center px-3 py-1 text-xs font-bold focus:z-20 focus:outline-offset-0 cursor-pointer ${
                        pagination.page === i + 1 
                          ? 'z-10 bg-[#0f766e] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]' 
                          : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(Math.ceil(totalCount / prev.limit), prev.page + 1) }))}
                  disabled={pagination.page === Math.ceil(totalCount / pagination.limit) || totalCount === 0}
                  className="relative inline-flex items-center rounded-r-md px-2 py-1 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 cursor-pointer"
                >
                  <span className="text-xs font-bold px-1">Sau &raquo;</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      <ServiceFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        initialData={editingService}
        nextSortOrder={totalCount + 1}
        createService={createService}
        updateService={updateService}
        uploadCoverImage={uploadCoverImage}
        removeCoverImage={removeCoverImage}
      />
    </div>
  );
}
