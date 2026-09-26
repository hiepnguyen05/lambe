import React, { useEffect, useRef, useState } from 'react'
import type { ServiceCategory } from '../../types/admin-categories.types'
import type {
  CreateServicePayload,
  StandardService,
  UpdateServicePayload,
} from '../../types/admin-services.types'
import { AdminIconPickerModal, EXPANDED_BEAUTY_ICONS } from '../categories/AdminIconPickerModal'

interface AdminServiceModalProps {
  service?: StandardService | null
  categories: ServiceCategory[]
  isOpen: boolean
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (
    payload: CreateServicePayload | UpdateServicePayload,
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

export function AdminServiceModal({
  service,
  categories,
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}: AdminServiceModalProps) {
  const [categoryId, setCategoryId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [iconUrl, setIconUrl] = useState('content_cut')
  const [minPriceAmount, setMinPriceAmount] = useState<number>(50000)
  const [maxPriceAmount, setMaxPriceAmount] = useState<number>(300000)
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState<number>(45)
  const [sortOrder, setSortOrder] = useState<number>(0)

  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isCodeTouched, setIsCodeTouched] = useState(false)
  const [isSlugTouched, setIsSlugTouched] = useState(false)

  // Icon Picker Modal
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)

  useEffect(() => {
    if (service) {
      setCategoryId(service.categoryId)
      setCode(service.code)
      setName(service.name)
      setSlug(service.slug)
      setDescription(service.description || '')
      setIconUrl(service.iconUrl || 'content_cut')
      setMinPriceAmount(service.minPriceAmount)
      setMaxPriceAmount(service.maxPriceAmount)
      setDefaultDurationMinutes(service.defaultDurationMinutes || 45)
      setSortOrder(service.sortOrder)
      setCoverFile(null)
      setCoverPreviewUrl(service.coverImageUrl || null)
      setIsCodeTouched(true)
      setIsSlugTouched(true)
    } else {
      setCategoryId(categories.length > 0 ? categories[0].id : '')
      setCode('')
      setName('')
      setSlug('')
      setDescription('')
      setIconUrl('content_cut')
      setMinPriceAmount(50000)
      setMaxPriceAmount(300000)
      setDefaultDurationMinutes(45)
      setSortOrder(0)
      setCoverFile(null)
      setCoverPreviewUrl(null)
      setIsCodeTouched(false)
      setIsSlugTouched(false)
    }
  }, [service, categories, isOpen])

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

    if (minPriceAmount > maxPriceAmount) {
      alert('Giá sàn (Min price) không được lớn hơn Giá trần (Max price).')
      return
    }

    if (service) {
      const payload: UpdateServicePayload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        minPriceAmount: Number(minPriceAmount),
        maxPriceAmount: Number(maxPriceAmount),
        defaultDurationMinutes: Number(defaultDurationMinutes) || undefined,
        sortOrder: Number(sortOrder) || 0,
      }
      void onSubmit(payload, coverFile)
    } else {
      const payload: CreateServicePayload = {
        categoryId: categoryId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        minPriceAmount: Number(minPriceAmount),
        maxPriceAmount: Number(maxPriceAmount),
        defaultDurationMinutes: Number(defaultDurationMinutes) || undefined,
        sortOrder: Number(sortOrder) || 0,
      }
      void onSubmit(payload, coverFile)
    }
  }

  const selectedIconObj = EXPANDED_BEAUTY_ICONS.find((item) => item.icon === iconUrl)

  if (!isOpen) return null

  return (
    <>
      <div className="admin-modal-backdrop" onClick={onClose}>
        <div className="admin-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal__header">
            <h3 className="admin-modal__title">
              {service ? 'Chỉnh sửa Dịch vụ Chuẩn' : 'Thêm Dịch vụ Chuẩn Mới'}
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
                <label>Ảnh bìa dịch vụ (Tùy chọn - JPG/PNG/WEBP $\le$ 5MB)</label>
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

              {/* Category selector */}
              {!service && (
                <div className="admin-modal__field">
                  <label htmlFor="svc-cat">Danh mục dịch vụ chuẩn *</label>
                  <select
                    id="svc-cat"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    disabled={isSubmitting}
                  >
                    {categories.length === 0 && <option value="">Chưa có danh mục nào</option>}
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Service Name */}
              <div className="admin-modal__field">
                <label htmlFor="svc-name">Tên dịch vụ chuẩn *</label>
                <input
                  id="svc-name"
                  type="text"
                  placeholder="VD: Cắt tóc nam phong cách Classic"
                  value={name}
                  onChange={handleNameChange}
                  required
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              {/* Code & Slug */}
              <div className="admin-modal__grid-2">
                <div className="admin-modal__field">
                  <label htmlFor="svc-code">Mã code dịch vụ {service ? '(Khóa)' : '*'}</label>
                  <input
                    id="svc-code"
                    type="text"
                    placeholder="VD: MEN_HAIRCUT"
                    value={code}
                    onChange={handleCodeChange}
                    required
                    disabled={isSubmitting || !!service}
                  />
                </div>

                <div className="admin-modal__field">
                  <label htmlFor="svc-slug">Slug đường dẫn URL *</label>
                  <input
                    id="svc-slug"
                    type="text"
                    placeholder="VD: cat-toc-nam-classic"
                    value={slug}
                    onChange={handleSlugChange}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Price Range: Min & Max Price */}
              <div className="admin-modal__grid-2">
                <div className="admin-modal__field">
                  <label htmlFor="svc-min-price">Giá sàn (Min Price - VND) *</label>
                  <input
                    id="svc-min-price"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="50000"
                    value={minPriceAmount}
                    onChange={(e) => setMinPriceAmount(Number(e.target.value))}
                    required
                    disabled={isSubmitting}
                  />
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                      minPriceAmount || 0,
                    )}
                  </span>
                </div>

                <div className="admin-modal__field">
                  <label htmlFor="svc-max-price">Giá trần (Max Price - VND) *</label>
                  <input
                    id="svc-max-price"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="300000"
                    value={maxPriceAmount}
                    onChange={(e) => setMaxPriceAmount(Number(e.target.value))}
                    required
                    disabled={isSubmitting}
                  />
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                      maxPriceAmount || 0,
                    )}
                  </span>
                </div>
              </div>

              {/* Duration & Sort order */}
              <div className="admin-modal__grid-2">
                <div className="admin-modal__field">
                  <label htmlFor="svc-duration">Thời lượng mặc định (phút)</label>
                  <input
                    id="svc-duration"
                    type="number"
                    min={15}
                    max={720}
                    step={5}
                    placeholder="45"
                    value={defaultDurationMinutes}
                    onChange={(e) => setDefaultDurationMinutes(Number(e.target.value))}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="admin-modal__field">
                  <label htmlFor="svc-sort">Thứ tự ưu tiên (Sort Order)</label>
                  <input
                    id="svc-sort"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Icon selection */}
              <div className="admin-modal__field">
                <label>Biểu tượng dịch vụ</label>
                <div className="admin-icon-trigger-box">
                  <div className="admin-icon-trigger-box__left">
                    <div className="admin-icon-trigger-box__icon">
                      <span className="material-symbols-outlined">{iconUrl || 'content_cut'}</span>
                    </div>
                    <div className="admin-icon-trigger-box__info">
                      <span className="admin-icon-trigger-box__label">
                        {selectedIconObj ? selectedIconObj.label : 'Biểu tượng hiện tại'}
                      </span>
                      <span className="admin-icon-trigger-box__code">
                        {iconUrl || 'content_cut'}
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

              {/* Description */}
              <div className="admin-modal__field">
                <label htmlFor="svc-desc">Mô tả dịch vụ</label>
                <textarea
                  id="svc-desc"
                  rows={3}
                  placeholder="Mô tả phạm vi, điều kiện dịch vụ và các bước thực hiện..."
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
                ) : service ? (
                  <span>Cập nhật</span>
                ) : (
                  <span>Tạo dịch vụ</span>
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
