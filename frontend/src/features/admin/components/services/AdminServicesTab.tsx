import { useEffect, useState } from 'react'
import { adminCategoriesApi } from '../../api/admin-categories.api'
import { adminServicesApi } from '../../api/admin-services.api'
import type { ServiceCategory } from '../../types/admin-categories.types'
import type {
  CreateServicePayload,
  ServiceStatus,
  StandardService,
  UpdateServicePayload,
} from '../../types/admin-services.types'
import { AdminCoverImageModal } from './AdminCoverImageModal'
import { AdminReorderServicesModal } from './AdminReorderServicesModal'
import { AdminServiceModal } from './AdminServiceModal'
import './AdminServicesTab.css'

interface AdminServicesTabProps {
  onShowToast: (title: string, message: string, icon?: string, isError?: boolean) => void
}

export function AdminServicesTab({ onShowToast }: AdminServicesTabProps) {
  const [services, setServices] = useState<StandardService[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters & Pagination
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(15)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Modals
  const [isCreateEditModalOpen, setIsCreateEditModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<StandardService | null>(null)

  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false)
  const [coverService, setCoverService] = useState<StandardService | null>(null)

  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false)
  const [reorderCategory, setReorderCategory] = useState<ServiceCategory | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load categories list for filter dropdown & create modal
  const loadCategories = async () => {
    try {
      const data = await adminCategoriesApi.getAll()
      setCategories(data)
    } catch {
      // Ignore background category load errors
    }
  }

  const loadServices = async () => {
    setIsLoading(true)
    try {
      const res = await adminServicesApi.getAll({
        search: search.trim() || undefined,
        categoryId: categoryFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit,
      })
      setServices(res.data)
      setTotal(res.meta.total)
      setTotalPages(res.meta.totalPages)
    } catch (err: any) {
      onShowToast('Lỗi tải dịch vụ', err.message || 'Không thể lấy danh sách dịch vụ.', 'error', true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCategories()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadServices()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, categoryFilter, statusFilter, page])

  const handleOpenCreateModal = () => {
    setEditingService(null)
    setIsCreateEditModalOpen(true)
  }

  const handleOpenEditModal = (service: StandardService) => {
    setEditingService(service)
    setIsCreateEditModalOpen(true)
  }

  const handleOpenCoverModal = (service: StandardService) => {
    setCoverService(service)
    setIsCoverModalOpen(true)
  }

  const handleOpenReorderModal = () => {
    if (!categoryFilter) {
      if (categories.length > 0) {
        setReorderCategory(categories[0])
      } else {
        onShowToast('Cảnh báo', 'Vui lòng chọn 1 danh mục để sắp xếp dịch vụ.', 'warning', true)
        return
      }
    } else {
      const found = categories.find((c) => c.id === categoryFilter)
      setReorderCategory(found || null)
    }
    setIsReorderModalOpen(true)
  }

  const handleCreateEditSubmit = async (
    payload: CreateServicePayload | UpdateServicePayload,
    coverFile?: File | null,
  ) => {
    setIsSubmitting(true)
    try {
      let savedService: StandardService
      if (editingService) {
        savedService = await adminServicesApi.update(
          editingService.id,
          payload as UpdateServicePayload,
        )
        onShowToast('Cập nhật thành công', `Đã cập nhật dịch vụ "${payload.name}".`, 'check_circle')
      } else {
        savedService = await adminServicesApi.create(payload as CreateServicePayload)
        onShowToast('Tạo thành công', `Đã tạo dịch vụ mới "${payload.name}".`, 'add_circle')
      }

      if (coverFile) {
        await adminServicesApi.uploadCoverImage(savedService.id, coverFile)
      }

      setIsCreateEditModalOpen(false)
      void loadServices()
    } catch (err: any) {
      onShowToast('Thao tác thất bại', err.message || 'Không thể lưu dịch vụ.', 'error', true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (service: StandardService) => {
    const nextStatus: ServiceStatus =
      service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    try {
      await adminServicesApi.updateStatus(service.id, nextStatus)
      onShowToast(
        'Đổi trạng thái',
        `Dịch vụ "${service.name}" đã chuyển sang ${
          nextStatus === 'ACTIVE' ? 'Hoạt động' : 'Tạm ẩn'
        }.`,
        'swap_horiz',
      )
      void loadServices()
    } catch (err: any) {
      onShowToast('Thao tác thất bại', err.message || 'Không thể đổi trạng thái.', 'error', true)
    }
  }

  const handleArchive = async (service: StandardService) => {
    if (!window.confirm(`Bạn có chắc muốn lưu trữ dịch vụ chuẩn "${service.name}"?`)) {
      return
    }

    try {
      await adminServicesApi.updateStatus(service.id, 'ARCHIVED')
      onShowToast('Lưu trữ thành công', `Đã lưu trữ dịch vụ "${service.name}".`, 'archive')
      void loadServices()
    } catch (err: any) {
      onShowToast('Thao tác thất bại', err.message || 'Không thể lưu trữ dịch vụ.', 'error', true)
    }
  }

  const handleCoverUpload = async (file: File) => {
    if (!coverService) return
    setIsSubmitting(true)
    try {
      await adminServicesApi.uploadCoverImage(coverService.id, file)
      onShowToast('Tải ảnh bìa thành công', `Đã tải ảnh bìa mới cho "${coverService.name}".`, 'image')
      setIsCoverModalOpen(false)
      void loadServices()
    } catch (err: any) {
      onShowToast('Tải ảnh thất bại', err.message || 'Không thể tải ảnh bìa.', 'error', true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCoverRemove = async () => {
    if (!coverService) return
    setIsSubmitting(true)
    try {
      await adminServicesApi.removeCoverImage(coverService.id)
      onShowToast('Xóa ảnh bìa', `Đã xóa ảnh bìa của dịch vụ "${coverService.name}".`, 'delete')
      setIsCoverModalOpen(false)
      void loadServices()
    } catch (err: any) {
      onShowToast('Xóa ảnh thất bại', err.message || 'Không thể xóa ảnh bìa.', 'error', true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveReorder = async (items: Array<{ id: string; sortOrder: number }>) => {
    if (!reorderCategory) return
    setIsSubmitting(true)
    try {
      await adminServicesApi.reorder(reorderCategory.id, { items })
      onShowToast('Sắp xếp thành công', `Đã cập nhật thứ tự dịch vụ trong "${reorderCategory.name}".`, 'reorder')
      setIsReorderModalOpen(false)
      void loadServices()
    } catch (err: any) {
      onShowToast('Thao tác thất bại', err.message || 'Không thể lưu thứ tự.', 'error', true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
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
              placeholder="Tìm theo tên dịch vụ, mã code, slug..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <select
            className="admin-cat-select"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.code})
              </option>
            ))}
          </select>

          <select
            className="admin-cat-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động (Active)</option>
            <option value="INACTIVE">Tạm ẩn (Inactive)</option>
            <option value="ARCHIVED">Lưu trữ (Archived)</option>
          </select>
        </div>

        <div className="admin-cat-toolbar__actions">
          <button
            type="button"
            className="admin-cat-btn admin-cat-btn--ghost"
            onClick={handleOpenReorderModal}
            title="Sắp xếp thứ tự dịch vụ"
          >
            <span className="material-symbols-outlined">reorder</span>
            Sắp xếp thứ tự
          </button>

          <button
            type="button"
            className="admin-cat-btn admin-cat-btn--ghost"
            onClick={() => void loadServices()}
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
            Thêm dịch vụ chuẩn mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="admin-cat-table-wrapper">
        <table className="admin-cat-table">
          <thead>
            <tr>
              <th style={{ width: 56, textAlign: 'center' }}>Bìa/Icon</th>
              <th>Mã Code</th>
              <th>Tên Dịch Vụ & Slug</th>
              <th>Danh mục</th>
              <th>Khung Giá Sàn - Trần (VND)</th>
              <th>Thời lượng</th>
              <th>Thứ tự</th>
              <th>Trạng thái</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '32px' }}>
                  <span className="admin-spinner" style={{ margin: '0 auto 8px' }} />
                  <p style={{ color: 'var(--color-secondary)', margin: 0 }}>
                    Đang tải danh sách dịch vụ chuẩn...
                  </p>
                </td>
              </tr>
            )}

            {!isLoading && services.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 36, color: 'var(--color-outline)', marginBottom: 8 }}
                  >
                    design_services
                  </span>
                  <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Không tìm thấy dịch vụ chuẩn nào</p>
                  <p style={{ color: 'var(--color-secondary)', fontSize: 13, margin: 0 }}>
                    Thử thay đổi bộ lọc tìm kiếm hoặc bấm nút "Thêm dịch vụ chuẩn mới".
                  </p>
                </td>
              </tr>
            )}

            {!isLoading &&
              services.map((svc) => (
                <tr key={svc.id}>
                  <td style={{ textAlign: 'center' }}>
                    <div
                      className="admin-svc-cover-box"
                      onClick={() => handleOpenCoverModal(svc)}
                      title="Quản lý ảnh bìa"
                    >
                      {svc.coverImageUrl ? (
                        <img src={svc.coverImageUrl} alt={svc.name} className="admin-svc-thumb" />
                      ) : (
                        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                          {svc.iconUrl || 'content_cut'}
                        </span>
                      )}
                      <div className="admin-svc-cover-overlay">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_camera</span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className="admin-cat-code">{svc.code}</span>
                  </td>

                  <td>
                    <div className="admin-cat-name-box">
                      <span className="admin-cat-name">{svc.name}</span>
                      <span className="admin-cat-slug">/{svc.slug}</span>
                    </div>
                  </td>

                  <td>
                    <span className="admin-svc-cat-badge">
                      {svc.category?.name || 'Chưa rõ'}
                    </span>
                  </td>

                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>
                      {formatVND(svc.minPriceAmount)} - {formatVND(svc.maxPriceAmount)}
                    </div>
                  </td>

                  <td>
                    <span style={{ fontSize: 13 }}>
                      {svc.defaultDurationMinutes ? `${svc.defaultDurationMinutes} phút` : '—'}
                    </span>
                  </td>

                  <td style={{ fontWeight: 600 }}>{svc.sortOrder}</td>

                  <td>
                    <span
                      className={`admin-cat-badge ${
                        svc.status === 'ACTIVE'
                          ? 'admin-cat-badge--active'
                          : svc.status === 'INACTIVE'
                          ? 'admin-cat-badge--inactive'
                          : 'admin-cat-badge--archived'
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        {svc.status === 'ACTIVE'
                          ? 'check_circle'
                          : svc.status === 'INACTIVE'
                          ? 'visibility_off'
                          : 'archive'}
                      </span>
                      {svc.status === 'ACTIVE'
                        ? 'Hoạt động'
                        : svc.status === 'INACTIVE'
                        ? 'Tạm ẩn'
                        : 'Lưu trữ'}
                    </span>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <div className="admin-cat-actions" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="admin-cat-icon-btn"
                        title="Quản lý ảnh bìa"
                        onClick={() => handleOpenCoverModal(svc)}
                      >
                        <span className="material-symbols-outlined">image</span>
                      </button>

                      <button
                        type="button"
                        className="admin-cat-icon-btn"
                        title="Đổi trạng thái Ẩn/Hiện"
                        onClick={() => void handleToggleStatus(svc)}
                      >
                        <span className="material-symbols-outlined">
                          {svc.status === 'ACTIVE' ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="admin-cat-icon-btn"
                        title="Chỉnh sửa dịch vụ"
                        onClick={() => handleOpenEditModal(svc)}
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>

                      {svc.status !== 'ARCHIVED' && (
                        <button
                          type="button"
                          className="admin-cat-icon-btn admin-cat-icon-btn--danger"
                          title="Lưu trữ dịch vụ"
                          onClick={() => void handleArchive(svc)}
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

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="admin-svc-pagination">
          <span style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
            Hiển thị tổng số <strong>{total}</strong> dịch vụ
          </span>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="admin-cat-btn admin-cat-btn--ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              <span className="material-symbols-outlined">chevron_left</span>
              Trang trước
            </button>

            <span style={{ fontSize: 13, padding: '0 8px', fontWeight: 600 }}>
              Trang {page} / {totalPages}
            </span>

            <button
              type="button"
              className="admin-cat-btn admin-cat-btn--ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
            >
              Trang sau
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AdminServiceModal
        service={editingService}
        categories={categories}
        isOpen={isCreateEditModalOpen}
        isSubmitting={isSubmitting}
        onClose={() => setIsCreateEditModalOpen(false)}
        onSubmit={handleCreateEditSubmit}
      />

      <AdminCoverImageModal
        service={coverService}
        isOpen={isCoverModalOpen}
        isSubmitting={isSubmitting}
        onClose={() => setIsCoverModalOpen(false)}
        onUpload={handleCoverUpload}
        onRemove={handleCoverRemove}
      />

      <AdminReorderServicesModal
        category={reorderCategory}
        services={services.filter((s) => s.categoryId === reorderCategory?.id)}
        isOpen={isReorderModalOpen}
        isSubmitting={isSubmitting}
        onClose={() => setIsReorderModalOpen(false)}
        onSaveReorder={handleSaveReorder}
      />
    </div>
  )
}
