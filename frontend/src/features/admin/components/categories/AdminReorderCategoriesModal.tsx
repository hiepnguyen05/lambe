import { useEffect, useState } from 'react'
import type { ServiceCategory } from '../../types/admin-categories.types'

interface AdminReorderCategoriesModalProps {
  categories: ServiceCategory[]
  isOpen: boolean
  isSubmitting: boolean
  onClose: () => void
  onSaveReorder: (items: Array<{ id: string; sortOrder: number }>) => Promise<void>
}

export function AdminReorderCategoriesModal({
  categories,
  isOpen,
  isSubmitting,
  onClose,
  onSaveReorder,
}: AdminReorderCategoriesModalProps) {
  const [orderedItems, setOrderedItems] = useState<ServiceCategory[]>([])

  useEffect(() => {
    if (categories) {
      setOrderedItems([...categories].sort((a, b) => a.sortOrder - b.sortOrder))
    }
  }, [categories, isOpen])

  if (!isOpen) return null

  const moveUp = (index: number) => {
    if (index === 0) return
    const newItems = [...orderedItems]
    const temp = newItems[index - 1]
    newItems[index - 1] = newItems[index]
    newItems[index] = temp
    setOrderedItems(newItems)
  }

  const moveDown = (index: number) => {
    if (index === orderedItems.length - 1) return
    const newItems = [...orderedItems]
    const temp = newItems[index + 1]
    newItems[index + 1] = newItems[index]
    newItems[index] = temp
    setOrderedItems(newItems)
  }

  const handleSave = () => {
    const payloadItems = orderedItems.map((item, idx) => ({
      id: item.id,
      sortOrder: idx,
    }))
    void onSaveReorder(payloadItems)
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h3 className="admin-modal__title">Sắp Xếp Thứ Tự Danh Mục Dịch Vụ</h3>
          <button
            type="button"
            className="admin-modal__close-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="admin-modal__body">
          <p style={{ fontSize: 13, color: 'var(--color-secondary)', margin: '0 0 12px' }}>
            Sử dụng nút mũi tên để thay đổi vị trí sắp xếp của các Danh mục dịch vụ hiển thị trên hệ thống.
          </p>

          {orderedItems.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-secondary)' }}>
              Chưa có danh mục nào để sắp xếp.
            </p>
          ) : (
            <div className="admin-reorder-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orderedItems.map((item, index) => (
                <div
                  key={item.id}
                  className="admin-reorder-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--color-outline-variant, #e0e0e0)',
                    background: 'var(--color-surface, #fff)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: 'var(--color-primary)',
                        minWidth: 24,
                      }}
                    >
                      #{index + 1}
                    </span>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                      {item.iconUrl || 'category'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                        Mã: {item.code} | Slug: /{item.slug}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="admin-cat-icon-btn"
                      onClick={() => moveUp(index)}
                      disabled={index === 0 || isSubmitting}
                      title="Di chuyển lên"
                    >
                      <span className="material-symbols-outlined">arrow_upward</span>
                    </button>

                    <button
                      type="button"
                      className="admin-cat-icon-btn"
                      onClick={() => moveDown(index)}
                      disabled={index === orderedItems.length - 1 || isSubmitting}
                      title="Di chuyển xuống"
                    >
                      <span className="material-symbols-outlined">arrow_downward</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
            type="button"
            className="admin-cat-btn admin-cat-btn--primary"
            onClick={handleSave}
            disabled={isSubmitting || orderedItems.length === 0}
          >
            {isSubmitting ? 'Đang lưu thứ tự...' : 'Lưu Thứ Tự Sắp Xếp'}
          </button>
        </div>
      </div>
    </div>
  )
}
