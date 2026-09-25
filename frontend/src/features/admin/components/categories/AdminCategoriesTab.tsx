import { useEffect, useState } from 'react'
import { adminCategoriesApi } from '../../api/admin-categories.api'
import type {
  CreateCategoryPayload,
  ServiceCategory,
  ServiceCategoryStatus,
} from '../../types/admin-categories.types'
import { AdminCategoryModal } from './AdminCategoryModal'
import './AdminCategoriesTab.css'

interface AdminCategoriesTabProps {
  onShowToast: (title: string, message: string, icon?: string, isError?: boolean) => void
}

export function AdminCategoriesTab({ onShowToast }: AdminCategoriesTabProps) {
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadCategories = async () => {
    setIsLoading(true)
    try {
      const data = await adminCategoriesApi.getAll({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      })
      setCategories(data)
    } catch (err: any) {
      onShowToast('Lỗi tải danh mục', err.message || 'Không thể lấy danh sách danh mục.', 'error', true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCategories()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, statusFilter])

  const handleOpenCreateModal = () => {
    setEditingCategory(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (category: ServiceCategory) => {
    setEditingCategory(category)
    setIsModalOpen(true)
  }

  const handleModalSubmit = async (payload: CreateCategoryPayload) => {
    setIsSubmitting(true)
    try {
      if (editingCategory) {
        await adminCategoriesApi.update(editingCategory.id, payload)
        onShowToast('Cập nhật thành công', `Đã cập nhật danh mục "${payload.name}".`, 'check_circle')
      } else {
        await adminCategoriesApi.create(payload)
        onShowToast('Tạo thành công', `Đã tạo danh mục mới "${payload.name}".`, 'add_circle')
      }
      setIsModalOpen(false)
      void loadCategories()
    } catch (err: any) {
      onShowToast('Thao tác thất bại', err.message || 'Không thể lưu danh mục.', 'error', true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (category: ServiceCategory) => {
    const nextStatus: ServiceCategoryStatus =
      category.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    try {
      await adminCategoriesApi.update(category.id, { status: nextStatus })
      onShowToast(
        'Đổi trạng thái',
        `Danh mục "${category.name}" đã chuyển sang ${
          nextStatus === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ẩn'
        }.`,
        'swap_horiz'
      )
      void loadCategories()
    } catch (err: any) {
      onShowToast('Thao tác thất bại', err.message || 'Không thể đổi trạng thái.', 'error', true)
    }
  }

  const handleArchive = async (category: ServiceCategory) => {
    if (!window.confirm(`Bạn có chắc chắn muốn lưu trữ danh mục "${category.name}"?`)) {
      return
    }

    try {
      await adminCategoriesApi.delete(category.id)
      onShowToast('Lưu trữ thành công', `Đã lưu trữ danh mục "${category.name}".`, 'archive')
      void loadCategories()
    } catch (err: any) {
      onShowToast('Thao tác thất bại', err.message || 'Không thể lưu trữ danh mục.', 'error', true)
    }
  }

  return (
    <div className="admin-cat-tab">
      {/* Toolbar */}
      <div className="admin-cat-toolbar">
        <div className="admin-cat-toolbar__filters">
          <div className="admin-cat-search">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="Tìm theo tên, mã code, mô tả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="admin-cat-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động (Active)</option>
            <option value="INACTIVE">Tạm ẩn (Inactive)</option>
            <option value="ARCHIVED">Đã lưu trữ (Archived)</option>
          </select>
        </div>

        <div className="admin-cat-toolbar__actions">
          <button
            type="button"
            className="admin-cat-btn admin-cat-btn--ghost"
            onClick={() => void loadCategories()}
            title="Tải lại dữ liệu"
          >
            <span className="material-symbols-outlined">refresh</span>
            Tải lại
          </button>

          <button
            type="button"
            className="admin-cat-btn admin-cat-btn--primary"
            onClick={handleOpenCreateModal}
          >
            <span className="material-symbols-outlined">add</span>
            Thêm danh mục mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="admin-cat-table-wrapper">
        <table className="admin-cat-table">
          <thead>
            <tr>
              <th style={{ width: 48, textAlign: 'center' }}>Icon</th>
              <th>Mã Code</th>
              <th>Tên Danh Mục & Slug</th>
              <th>Mô tả</th>
              <th>Thứ tự</th>
              <th>Trạng thái</th>
              <th>Người cập nhật</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>
                  <span className="admin-spinner" style={{ margin: '0 auto 8px' }} />
                  <p style={{ color: 'var(--color-secondary)', margin: 0 }}>
                    Đang tải danh mục dịch vụ...
                  </p>
                </td>
              </tr>
            )}

            {!isLoading && categories.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 36, color: 'var(--color-outline)', marginBottom: 8 }}
                  >
                    folder_off
                  </span>
                  <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Không tìm thấy danh mục dịch vụ nào</p>
                  <p style={{ color: 'var(--color-secondary)', fontSize: 13, margin: 0 }}>
                    Thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Thêm danh mục mới" để tạo.
                  </p>
                </td>
              </tr>
            )}

            {!isLoading &&
              categories.map((cat) => (
                <tr key={cat.id}>
                  <td style={{ textAlign: 'center' }}>
                    <div className="admin-cat-table-icon">
                      <span className="material-symbols-outlined">
                        {cat.iconUrl || 'category'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="admin-cat-code">{cat.code}</span>
                  </td>
                  <td>
                    <div className="admin-cat-name-box">
                      <span className="admin-cat-name">{cat.name}</span>
                      <span className="admin-cat-slug">/{cat.slug}</span>
                    </div>
                  </td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.description || '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{cat.sortOrder}</td>
                  <td>
                    <span
                      className={`admin-cat-badge ${
                        cat.status === 'ACTIVE'
                          ? 'admin-cat-badge--active'
                          : cat.status === 'INACTIVE'
                          ? 'admin-cat-badge--inactive'
                          : 'admin-cat-badge--archived'
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        {cat.status === 'ACTIVE'
                          ? 'check_circle'
                          : cat.status === 'INACTIVE'
                          ? 'visibility_off'
                          : 'archive'}
                      </span>
                      {cat.status === 'ACTIVE'
                        ? 'Hoạt động'
                        : cat.status === 'INACTIVE'
                        ? 'Tạm ẩn'
                        : 'Lưu trữ'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--color-secondary)' }}>
                    {cat.updatedBy?.fullName || cat.createdBy?.fullName || 'Hệ thống'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="admin-cat-actions" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="admin-cat-icon-btn"
                        title="Đổi trạng thái Ẩn/Hiện"
                        onClick={() => void handleToggleStatus(cat)}
                      >
                        <span className="material-symbols-outlined">
                          {cat.status === 'ACTIVE' ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="admin-cat-icon-btn"
                        title="Chỉnh sửa"
                        onClick={() => handleOpenEditModal(cat)}
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>

                      {cat.status !== 'ARCHIVED' && (
                        <button
                          type="button"
                          className="admin-cat-icon-btn admin-cat-icon-btn--danger"
                          title="Lưu trữ danh mục"
                          onClick={() => void handleArchive(cat)}
                        >
                          <span className="material-symbols-outlined">archive</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

          </tbody>
        </table>
      </div>

      {/* Modal */}
      <AdminCategoryModal
        isOpen={isModalOpen}
        category={editingCategory}
        isSubmitting={isSubmitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
      />
    </div>
  )
}
