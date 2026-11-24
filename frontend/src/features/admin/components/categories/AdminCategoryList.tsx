import { useState } from 'react';
import { useAdminCategories } from '../../hooks/useAdminCategories';
import type { AdminCategory } from '../../hooks/useAdminCategories';
import { useDebounce } from '../../hooks/useDebounce';
import { useDialog } from '../../../../components/ui/dialog-context';
import { Plus, Search, Edit2, CheckCircle2, Trash2, Lock, Unlock, X, ChevronUp, ChevronDown } from 'lucide-react';
import { CategoryFormModal } from './CategoryFormModal';
import { LambeIcon } from '../../../../components/ui/LambeIcon';

export function AdminCategoryList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AdminCategory['status']>('ALL');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchQuery.trim().toLowerCase(), 350);
  const {
    categories, totalCount, totalPages, isLoading, isFetching, error, refetch,
    updateStatus, createCategory, updateCategory, uploadCoverImage,
    removeCoverImage, reorderCategories,
  } = useAdminCategories({
    search: debouncedSearch || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    page,
    limit: 20,
  });
  const { showDialog } = useDialog();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextSortOrder = totalCount + 1;

  const handleToggleStatus = async (category: AdminCategory) => {
    const newStatus = category.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateStatus(category.id, newStatus);
      showDialog({
        title: 'Thành công',
        message: `Đã ${newStatus === 'ACTIVE' ? 'kích hoạt' : 'khóa'} danh mục ${category.name}.`,
        type: 'success',
      });
    } catch (error: unknown) {
      showDialog({
        title: 'Lỗi',
        message: error instanceof Error ? error.message : 'Không thể cập nhật danh mục.',
        type: 'error',
      });
    }
  };

  const handleDelete = (category: AdminCategory) => {
    showDialog({
      title: 'Lưu trữ danh mục',
      message: `Bạn có chắc chắn muốn lưu trữ danh mục "${category.name}"?`,
      type: 'warning',
      confirmText: 'Lưu trữ',
      onConfirm: async () => {
        try {
          await updateStatus(category.id, 'ARCHIVED');
          showDialog({
            title: 'Thành công',
            message: 'Đã lưu trữ danh mục thành công.',
            type: 'success',
          });
        } catch (error: unknown) {
          showDialog({
            title: 'Lỗi',
            message: error instanceof Error ? error.message : 'Không thể lưu trữ danh mục.',
            type: 'error',
          });
        }
      }
    });
  };

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const target = categories[index + direction];
    const current = categories[index];
    if (!target || !current) return;
    await reorderCategories([
      { id: current.id, sortOrder: target.sortOrder },
      { id: target.id, sortOrder: current.sortOrder },
    ]);
  };

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (category: AdminCategory) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (data: Partial<AdminCategory>, file: File | null) => {
    setIsSubmitting(true);
    try {
      let savedCategory: AdminCategory;
      if (editingCategory) {
        // Loại bỏ trường code khi cập nhật vì API không cho phép sửa mã danh mục
        const { code: _code, ...updateData } = data;
        savedCategory = await updateCategory(editingCategory.id, updateData);
        showDialog({ title: 'Thành công', message: 'Cập nhật danh mục thành công.', type: 'success' });
      } else {
        savedCategory = await createCategory(data);
        showDialog({ title: 'Thành công', message: 'Thêm mới danh mục thành công.', type: 'success' });
      }

      if (file) {
        await uploadCoverImage(savedCategory.id, file);
      }

      setIsModalOpen(false);
      refetch(); // Tải lại danh sách để chắc chắn dữ liệu mới nhất
    } catch (error: unknown) {
      showDialog({ title: 'Lỗi', message: error instanceof Error ? error.message : 'Không thể lưu danh mục.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/50 p-8 pt-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Quản lý danh mục</h1>
            <span className="bg-teal-100 text-[#0f766e] text-xs font-bold px-2.5 py-0.5 rounded-full ring-1 ring-teal-200">
              {totalCount} danh mục
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            Quản lý các danh mục dịch vụ hiển thị trên ứng dụng khách hàng.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => void refetch()}
            className="flex items-center justify-center px-4 py-2 bg-white text-slate-600 text-sm font-semibold border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition"
          >
            Làm mới
          </button>
          <button 
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-5 py-2 bg-[#0f766e] text-white text-sm font-bold rounded-xl shadow-sm hover:bg-[#0d5f58] transition active:scale-95 shadow-[#0f766e]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm mới</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6 p-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Tìm kiếm danh mục theo mã, tên..." 
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as 'ALL' | AdminCategory['status']); setPage(1); }}
              className="flex-1 md:w-48 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 font-medium"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Khóa</option>
              <option value="ARCHIVED">Đã lưu trữ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading && categories.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Đang tải dữ liệu...</div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 font-medium">{error}</div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium">Không có danh mục nào.</div>
        ) : (
          <div className={`overflow-x-auto ${isFetching ? 'opacity-60 transition-opacity' : ''}`}>
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="px-6 py-4 rounded-tl-2xl">Mã / Tên danh mục</th>
                  <th className="px-6 py-4">Mô tả</th>
                  <th className="px-6 py-4 text-center">Thứ tự</th>
                  <th className="px-6 py-4 text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-right rounded-tr-2xl">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((category, index) => (
                  <tr key={category.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-[#0f766e] ring-1 ring-teal-100/50 overflow-hidden flex-shrink-0 shadow-2xs">
                          <LambeIcon
                            nameOrUrl={category.iconUrl}
                            className="w-6 h-6 text-[#0f766e]"
                            imgClassName="w-full h-full object-cover block"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{category.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                            {category.code}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="line-clamp-2 max-w-xs text-slate-500 leading-relaxed">
                        {category.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle text-center">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" disabled={index === 0} onClick={() => void moveCategory(index, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-25" title="Đưa lên"><ChevronUp className="h-4 w-4" /></button>
                        <span className="font-semibold text-slate-700 bg-slate-100 w-8 h-8 rounded-lg inline-flex items-center justify-center">{category.sortOrder}</span>
                        <button type="button" disabled={index === categories.length - 1} onClick={() => void moveCategory(index, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-25" title="Đưa xuống"><ChevronDown className="h-4 w-4" /></button>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle text-center">
                      {category.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Hoạt động
                        </span>
                      ) : category.status === 'ARCHIVED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-slate-600 bg-slate-100 ring-1 ring-slate-200">Đã lưu trữ</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-rose-700 bg-rose-50 ring-1 ring-rose-200">
                          <Lock className="w-3.5 h-3.5" /> Tạm khóa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {category.status !== 'ARCHIVED' && <button
                          onClick={() => handleToggleStatus(category)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title={category.status === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt'}
                        >
                          {category.status === 'ACTIVE' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>}
                        {category.status !== 'ARCHIVED' && <button
                          onClick={() => handleOpenEditModal(category)}
                          className="p-2 text-slate-400 hover:text-[#0f766e] hover:bg-teal-50 rounded-lg transition"
                          title="Xem chi tiết / Chỉnh sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>}
                        {category.status !== 'ARCHIVED' && <button
                          onClick={() => handleDelete(category)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Lưu trữ danh mục"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span>Trang {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button>
            <button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button>
          </div>
        </div>
      )}

      <CategoryFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
        initialData={editingCategory}
        isLoading={isSubmitting}
        nextSortOrder={nextSortOrder}
        onRemoveCover={editingCategory?.coverImageUrl ? async () => {
          await removeCoverImage(editingCategory.id);
          setEditingCategory({ ...editingCategory, coverImageUrl: '' });
        } : undefined}
      />
    </div>
  );
}
