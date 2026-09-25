import React, { useEffect, useState } from 'react'
import type {
  CreateCategoryPayload,
  ServiceCategory,
  ServiceCategoryStatus,
} from '../../types/admin-categories.types'
import { AdminIconPickerModal, EXPANDED_BEAUTY_ICONS } from './AdminIconPickerModal'

interface AdminCategoryModalProps {
  category?: ServiceCategory | null
  isOpen: boolean
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: CreateCategoryPayload) => Promise<void>
}

function nameToUnaccented(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
}

function nameToSlug(str: string): string {
  return nameToUnaccented(str)
    .toLowerCase()
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function nameToCode(str: string): string {
  return nameToUnaccented(str)
    .toUpperCase()
    .replace(/([^0-9A-Z_\s])/g, '')
    .replace(/(\s+)/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function AdminCategoryModal({
  category,
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}: AdminCategoryModalProps) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [iconUrl, setIconUrl] = useState('content_cut')
  const [sortOrder, setSortOrder] = useState(0)
  const [status, setStatus] = useState<ServiceCategoryStatus>('ACTIVE')

  const [isCodeTouched, setIsCodeTouched] = useState(false)
  const [isSlugTouched, setIsSlugTouched] = useState(false)

  // Icon Picker Modal State
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)

  useEffect(() => {
    if (category) {
      setCode(category.code)
      setName(category.name)
      setSlug(category.slug)
      setDescription(category.description || '')
      setIconUrl(category.iconUrl || 'category')
      setSortOrder(category.sortOrder)
      setStatus(category.status)
      setIsCodeTouched(true)
      setIsSlugTouched(true)
    } else {
      setCode('')
      setName('')
      setSlug('')
      setDescription('')
      setIconUrl('content_cut')
      setSortOrder(0)
      setStatus('ACTIVE')
      setIsCodeTouched(false)
      setIsSlugTouched(false)
    }
  }, [category, isOpen])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setName(val)

    if (!isSlugTouched) {
      setSlug(nameToSlug(val))
    }
    if (!isCodeTouched) {
      setCode(nameToCode(val))
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase())
    setIsCodeTouched(true)
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value)
    setIsSlugTouched(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const payload: CreateCategoryPayload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim() || undefined,
      iconUrl: iconUrl.trim() || undefined,
      sortOrder: Number(sortOrder) || 0,
      status,
    }

    void onSubmit(payload)
  }

  const selectedIconObj = EXPANDED_BEAUTY_ICONS.find((item) => item.icon === iconUrl)

  if (!isOpen) return null

  return (
    <>
      <div className="admin-modal-backdrop" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal__header">
            <h3 className="admin-modal__title">
              {category ? 'Chỉnh sửa Danh mục' : 'Thêm Danh mục Dịch vụ Mới'}
            </h3>
            <button
              type="button"
              className="admin-modal__close-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="admin-modal__body">
              {/* Field: Name */}
              <div className="admin-modal__field">
                <label htmlFor="cat-name">Tên danh mục dịch vụ *</label>
                <input
                  id="cat-name"
                  type="text"
                  placeholder="VD: Cắt Tóc Nam & Tạo Kiểu"
                  value={name}
                  onChange={handleNameChange}
                  required
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              {/* Field: Code & Status */}
              <div className="admin-modal__grid-2">
                <div className="admin-modal__field">
                  <label htmlFor="cat-code">Mã code định danh *</label>
                  <input
                    id="cat-code"
                    type="text"
                    placeholder="VD: CAT_TOC"
                    value={code}
                    onChange={handleCodeChange}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="admin-modal__field">
                  <label htmlFor="cat-status">Trạng thái *</label>
                  <select
                    id="cat-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ServiceCategoryStatus)}
                    disabled={isSubmitting}
                  >
                    <option value="ACTIVE">Hoạt động (Active)</option>
                    <option value="INACTIVE">Tạm ẩn (Inactive)</option>
                    <option value="ARCHIVED">Đã lưu trữ (Archived)</option>
                  </select>
                </div>
              </div>

              {/* Field: Slug & Sort Order */}
              <div className="admin-modal__grid-2">
                <div className="admin-modal__field">
                  <label htmlFor="cat-slug">Slug đường dẫn URL *</label>
                  <input
                    id="cat-slug"
                    type="text"
                    placeholder="VD: cat-toc-tao-kieu"
                    value={slug}
                    onChange={handleSlugChange}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="admin-modal__field">
                  <label htmlFor="cat-sort">Thứ tự hiển thị (Sort Order)</label>
                  <input
                    id="cat-sort"
                    type="number"
                    placeholder="0"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Field: Icon Trigger Box */}
              <div className="admin-modal__field">
                <label>Biểu tượng Thẩm mỹ & Làm đẹp</label>
                <div className="admin-icon-trigger-box">
                  <div className="admin-icon-trigger-box__left">
                    <div className="admin-icon-trigger-box__icon">
                      <span className="material-symbols-outlined">{iconUrl || 'category'}</span>
                    </div>
                    <div className="admin-icon-trigger-box__info">
                      <span className="admin-icon-trigger-box__label">
                        {selectedIconObj ? selectedIconObj.label : 'Biểu tượng hiện tại'}
                      </span>
                      <span className="admin-icon-trigger-box__code">
                        {iconUrl || 'category'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="admin-cat-btn admin-cat-btn--ghost"
                    onClick={() => setIsIconPickerOpen(true)}
                    disabled={isSubmitting}
                  >
                    <span className="material-symbols-outlined">auto_awesome</span>
                    Chọn Icon
                  </button>
                </div>
              </div>

              {/* Field: Description */}
              <div className="admin-modal__field">
                <label htmlFor="cat-desc">Mô tả chi tiết</label>
                <textarea
                  id="cat-desc"
                  rows={3}
                  placeholder="Mô tả phạm vi dịch vụ thuộc danh mục này..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="admin-modal__footer">
              <button
                type="button"
                className="admin-cat-btn admin-cat-btn--ghost"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="admin-cat-btn admin-cat-btn--primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>Đang lưu...</span>
                ) : category ? (
                  <span>Cập nhật</span>
                ) : (
                  <span>Tạo danh mục</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Pop-up Icon Picker Dialog */}
      <AdminIconPickerModal
        isOpen={isIconPickerOpen}
        selectedIcon={iconUrl}
        onSelectIcon={(icon) => setIconUrl(icon)}
        onClose={() => setIsIconPickerOpen(false)}
      />
    </>
  )
}
