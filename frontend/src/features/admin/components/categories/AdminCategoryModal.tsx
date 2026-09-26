import React, { useEffect, useRef, useState } from 'react'
import type {
  CreateCategoryPayload,
  ServiceCategory,
  ServiceCategoryStatus,
  UpdateCategoryPayload,
} from '../../types/admin-categories.types'
import { AdminIconPickerModal, EXPANDED_BEAUTY_ICONS } from './AdminIconPickerModal'

interface AdminCategoryModalProps {
  category?: ServiceCategory | null
  isOpen: boolean
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (
    payload: CreateCategoryPayload | UpdateCategoryPayload,
    coverFile?: File | null,
  ) => Promise<void>
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
  const [status, setStatus] = useState<ServiceCategoryStatus>('INACTIVE')

  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isCodeTouched, setIsCodeTouched] = useState(false)
  const [isSlugTouched, setIsSlugTouched] = useState(false)
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
      setCoverFile(null)
      setCoverPreviewUrl(category.coverImageUrl || null)
      setIsCodeTouched(true)
      setIsSlugTouched(true)
    } else {
      setCode('')
      setName('')
      setSlug('')
      setDescription('')
      setIconUrl('content_cut')
      setSortOrder(0)
      setStatus('INACTIVE')
      setCoverFile(null)
      setCoverPreviewUrl(null)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Tệp ảnh quá lớn. Vui lòng chọn tệp nhỏ hơn 5MB.')
        return
      }
      setCoverFile(file)
      setCoverPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const payload: CreateCategoryPayload & UpdateCategoryPayload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim() || undefined,
      iconUrl: iconUrl.trim() || undefined,
      sortOrder: Number(sortOrder) || 0,
    }

    if (category) {
      payload.status = status
    }

    void onSubmit(payload, coverFile)
  }

  const selectedIconObj = EXPANDED_BEAUTY_ICONS.find((item) => item.icon === iconUrl)

  if (!isOpen) return null

  return (
    <>
      <div className="admin-modal-backdrop" onClick={onClose}>
        <div className="admin-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
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
              {/* Field: Cover Image Direct Upload */}
              <div className="admin-modal__field">
                <label>Ảnh bìa danh mục (Tùy chọn - JPG/PNG/WEBP $\le$ 5MB)</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 90,
                      height: 60,
                      borderRadius: 8,
                      border: '1px dashed var(--color-outline-variant, #ccc)',
                      background: 'var(--color-surface-variant, #f5f5f5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {coverPreviewUrl ? (
                      <img
                        src={coverPreviewUrl}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)' }}>
                        image
                      </span>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      type="button"
                      className="admin-cat-btn admin-cat-btn--ghost"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                    >
                      <span className="material-symbols-outlined">cloud_upload</span>
                      {coverFile ? 'Đổi ảnh khác' : coverPreviewUrl ? 'Thay ảnh bìa mới' : 'Tải ảnh bìa lên'}
                    </button>
                    {coverFile && (
                      <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>
                        Đã chọn: {coverFile.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

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
                  <label htmlFor="cat-status">
                    Trạng thái {category ? '*' : '(Mặc định: Tạm ẩn)'}
                  </label>
                  <select
                    id="cat-status"
                    value={category ? status : 'INACTIVE'}
                    onChange={(e) => setStatus(e.target.value as ServiceCategoryStatus)}
                    disabled={isSubmitting || !category}
                  >
                    <option value="INACTIVE">Tạm ẩn (Inactive)</option>
                    <option value="ACTIVE">Hoạt động (Active)</option>
                    <option value="ARCHIVED">Lưu trữ (Archived)</option>
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
