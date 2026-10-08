import { useState } from 'react';
import { useAdminCategories } from '../../hooks/useAdminCategories';
import type { AdminCategory } from '../../hooks/useAdminCategories';
import { useDialog } from '../../../../components/ui/DialogProvider';
import { Plus, Search, Edit2, CheckCircle2, Trash2, Lock, Unlock } from 'lucide-react';
import { CategoryFormModal } from './CategoryFormModal';

export function AdminCategoryList() {
  const { categories, isLoading, error, refetch, updateStatus, createCategory, updateCategory, uploadCoverImage } = useAdminCategories();
  const { showDialog } = useDialog();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lọc ra các danh mục chưa bị xóa (khác ARCHIVED)
  const activeCategories = categories.filter(c => c.status !== 'ARCHIVED');

  const nextSortOrder = activeCategories.length > 0 
    ? Math.max(...activeCategories.map(c => c.sortOrder || 0)) + 1 
    : 1;

  const handleToggleStatus = async (category: AdminCategory) => {
    const newStatus = category.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateStatus(category.id, newStatus);
      showDialog({
        title: 'Thành công',
        message: `Đã ${newStatus === 'ACTIVE' ? 'kích hoạt' : 'khóa'} danh mục ${category.name}.`,
        type: 'success',
      });
    } catch (error: any) {
      showDialog({
        title: 'Lỗi',
        message: error.message,
        type: 'error',
      });
    }
  };

  const handleDelete = (category: AdminCategory) => {
    showDialog({
      title: 'Xóa danh mục',
      message: `Bạn có chắc chắn muốn xóa danh mục "${category.name}"? Hành động này không thể hoàn tác.`,
      type: 'warning',
      confirmText: 'Xóa',
      onConfirm: async () => {
        try {
          await updateStatus(category.id, 'ARCHIVED');
          showDialog({
            title: 'Thành công',
            message: 'Đã xóa danh mục thành công.',
            type: 'success',
          });
        } catch (error: any) {
          showDialog({
            title: 'Lỗi',
            message: error.message,
            type: 'error',
          });
        }
      }
    });
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
        const { code, ...updateData } = data;
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
    } catch (error: any) {
      showDialog({ title: 'Lỗi', message: error.message, type: 'error' });
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
              {activeCategories.length} danh mục
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            Quản lý các danh mục dịch vụ hiển thị trên ứng dụng khách hàng.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={refetch}
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
              placeholder="Tìm kiếm danh mục theo mã, tên..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <select className="flex-1 md:w-48 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 font-medium">
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Khóa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Đang tải dữ liệu...</div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 font-medium">{error}</div>
        ) : activeCategories.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium">Không có danh mục nào.</div>
        ) : (
          <div className="overflow-x-auto">
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
                {activeCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-[#0f766e] ring-1 ring-teal-100/50">
                          <span className="material-symbols-outlined text-2xl">{category.iconUrl || 'category'}</span>
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
                      <span className="font-semibold text-slate-700 bg-slate-100 w-8 h-8 rounded-lg inline-flex items-center justify-center">
                        {category.sortOrder}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-middle text-center">
                      {category.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-rose-700 bg-rose-50 ring-1 ring-rose-200">
                          <Lock className="w-3.5 h-3.5" /> Tạm khóa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleToggleStatus(category)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition" 
                          title={category.status === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt'}
                        >
                          {category.status === 'ACTIVE' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleOpenEditModal(category)}
                          className="p-2 text-slate-400 hover:text-[#0f766e] hover:bg-teal-50 rounded-lg transition" 
                          title="Xem chi tiết / Chỉnh sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(category)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" 
                          title="Xóa danh mục"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CategoryFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
        initialData={editingCategory}
        isLoading={isSubmitting}
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}
