import React, { useRef, useState } from 'react'
import type { ServiceCategory } from '../../types/admin-categories.types'

interface AdminCategoryCoverModalProps {
  category: ServiceCategory | null
  isOpen: boolean
  isSubmitting: boolean
  onClose: () => void
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
}

export function AdminCategoryCoverModal({
  category,
  isOpen,
  isSubmitting,
  onClose,
  onUpload,
  onRemove,
}: AdminCategoryCoverModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen || !category) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Dung lượng tệp ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB.')
        return
      }
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return
    void onUpload(selectedFile)
  }

  const currentImage = previewUrl || category.coverImageUrl

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h3 className="admin-modal__title">Ảnh Bìa Danh Mục - {category.name}</h3>
          <button
            type="button"
            className="admin-modal__close-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleUploadSubmit}>
          <div className="admin-modal__body">
            <div className="admin-cover-preview-box">
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={category.name}
                  className="admin-cover-preview-img"
                />
              ) : (
                <div className="admin-cover-preview-placeholder">
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--color-outline)' }}>
                    image
                  </span>
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-secondary)' }}>
                    Chưa có ảnh bìa danh mục
                  </p>
                </div>
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

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="admin-cat-btn admin-cat-btn--ghost"
                style={{ flex: 1 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                <span className="material-symbols-outlined">upload_file</span>
                {selectedFile ? 'Đổi ảnh khác' : 'Chọn tệp ảnh từ máy tính'}
              </button>

              {category.coverImageUrl && !selectedFile && (
                <button
                  type="button"
                  className="admin-cat-btn admin-cat-btn--danger"
                  onClick={() => {
                    if (window.confirm('Bạn có chắc muốn xóa ảnh bìa hiện tại của danh mục?')) {
                      void onRemove()
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <span className="material-symbols-outlined">delete</span>
                  Xóa ảnh hiện tại
                </button>
              )}
            </div>

            <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 8, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
              Định dạng hỗ trợ: JPEG, PNG, WEBP, GIF (Tối đa 5 MB).
            </p>
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

            {selectedFile && (
              <button
                type="submit"
                className="admin-cat-btn admin-cat-btn--primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Đang tải lên...' : 'Lưu ảnh bìa mới'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
