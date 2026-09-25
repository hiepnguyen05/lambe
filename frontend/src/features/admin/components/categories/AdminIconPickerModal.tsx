import { useState } from 'react'

export interface BeautyIconItem {
  icon: string
  label: string
  group: 'hair' | 'nail' | 'makeup' | 'spa' | 'vip'
}

export const BEAUTY_ICON_GROUPS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'hair', label: 'Tóc & Salon' },
  { id: 'nail', label: 'Nail & Móng' },
  { id: 'makeup', label: 'Trang điểm' },
  { id: 'spa', label: 'Spa & Skincare' },
  { id: 'vip', label: 'VIP & Cao cấp' },
]

export const EXPANDED_BEAUTY_ICONS: BeautyIconItem[] = [
  // Hair & Barber
  { icon: 'content_cut', label: 'Cắt tóc nam/nữ', group: 'hair' },
  { icon: 'styler', label: 'Tạo kiểu & Uốn', group: 'hair' },
  { icon: 'dry', label: 'Sấy & Nhuộm tóc', group: 'hair' },
  { icon: 'shower', label: 'Gội đầu dưỡng sinh', group: 'hair' },
  { icon: 'brush', label: 'Nhuộm màu & Phủ bóng', group: 'hair' },
  { icon: 'design_services', label: 'Thiết kế mẫu tóc', group: 'hair' },

  // Nail
  { icon: 'back_hand', label: 'Làm móng / Nailart', group: 'nail' },
  { icon: 'handyman', label: 'Chăm sóc móng', group: 'nail' },
  { icon: 'palette', label: 'Bảng màu sơn', group: 'nail' },
  { icon: 'clean_hands', label: 'Tẩy móng & Dưỡng tay', group: 'nail' },
  { icon: 'dry_cleaning', label: 'Khử trùng dụng cụ', group: 'nail' },

  // Makeup
  { icon: 'face_3', label: 'Trang điểm dự tiệc', group: 'makeup' },
  { icon: 'face_5', label: 'Trang điểm cô dâu', group: 'makeup' },
  { icon: 'flare', label: 'Đánh khối & Phủ bóng', group: 'makeup' },
  { icon: 'magic_button', label: 'Làm đẹp nụ cười', group: 'makeup' },
  { icon: 'photo_camera_front', label: 'Makeup chụp ảnh', group: 'makeup' },
  { icon: 'visibility', label: 'Nối mi & Xăm mày', group: 'makeup' },

  // Spa & Skincare
  { icon: 'spa', label: 'Spa toàn thân', group: 'spa' },
  { icon: 'self_care', label: 'Massage thư giãn', group: 'spa' },
  { icon: 'water_drop', label: 'Cấp ẩm & Serum', group: 'spa' },
  { icon: 'sanitizer', label: 'Tẩy da chết & Detox', group: 'spa' },
  { icon: 'soap', label: 'Tắm trắng & Xông hơi', group: 'spa' },
  { icon: 'hot_tub', label: 'Ngâm chân thảo dược', group: 'spa' },
  { icon: 'nature_people', label: 'Chăm sóc dưỡng sinh', group: 'spa' },
  { icon: 'healing', label: 'Trị liệu da mặt', group: 'spa' },

  // VIP & Luxury
  { icon: 'crown', label: 'Gói Hoàng gia / VIP', group: 'vip' },
  { icon: 'diamond', label: 'Dịch vụ Kim Cương', group: 'vip' },
  { icon: 'auto_awesome', label: 'Thẩm mỹ công nghệ cao', group: 'vip' },
  { icon: 'verified', label: 'Dịch vụ Đạt chuẩn', group: 'vip' },
  { icon: 'award_star', label: 'Top Bán chạy', group: 'vip' },
  { icon: 'local_fire_department', label: 'Dịch vụ HOT nhất', group: 'vip' },
  { icon: 'favorite', label: 'Được yêu thích nhất', group: 'vip' },
  { icon: 'eco', label: 'Thảo mộc Organic', group: 'vip' },
  { icon: 'florist', label: 'Tinh dầu hoa tự nhiên', group: 'vip' },
  { icon: 'star', label: 'Dịch vụ 5 Sao', group: 'vip' },
  { icon: 'bolt', label: 'Làm đẹp siêu tốc', group: 'vip' },
]

interface AdminIconPickerModalProps {
  isOpen: boolean
  selectedIcon: string
  onSelectIcon: (iconSymbol: string) => void
  onClose: () => void
}

export function AdminIconPickerModal({
  isOpen,
  selectedIcon,
  onSelectIcon,
  onClose,
}: AdminIconPickerModalProps) {
  const [activeGroup, setActiveGroup] = useState<string>('all')
  const [search, setSearch] = useState('')

  if (!isOpen) return null

  const filteredIcons = EXPANDED_BEAUTY_ICONS.filter((item) => {
    const matchesGroup = activeGroup === 'all' || item.group === activeGroup
    const matchesSearch =
      !search.trim() ||
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.icon.toLowerCase().includes(search.toLowerCase())
    return matchesGroup && matchesSearch
  })

  return (
    <div className="admin-icon-modal-backdrop" onClick={onClose}>
      <div className="admin-icon-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-icon-modal__header">
          <h3 className="admin-icon-modal__title">
            <span className="material-symbols-outlined">auto_awesome</span>
            Bộ Sưu Tập Biểu Tượng Làm Đẹp & Thẩm Mỹ
          </h3>
          <button
            type="button"
            className="admin-modal__close-btn"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="admin-icon-modal__body">
          {/* Search Box */}
          <div className="admin-icon-modal__search-box">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="Tìm kiếm icon theo tên hoặc dịch vụ (VD: cắt tóc, spa, móng...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Group Filter Tabs */}
          <div className="admin-icon-modal__tabs">
            {BEAUTY_ICON_GROUPS.map((group) => {
              const isActive = activeGroup === group.id
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`admin-icon-tab-btn ${
                    isActive ? 'admin-icon-tab-btn--active' : ''
                  }`}
                  onClick={() => setActiveGroup(group.id)}
                >
                  {group.label}
                </button>
              )
            })}
          </div>

          {/* Rich Icon Cards Grid */}
          <div className="admin-icon-rich-grid">
            {filteredIcons.map((item) => {
              const isSelected = selectedIcon === item.icon
              return (
                <button
                  key={item.icon}
                  type="button"
                  className={`admin-icon-card ${
                    isSelected ? 'admin-icon-card--active' : ''
                  }`}
                  onClick={() => {
                    onSelectIcon(item.icon)
                    onClose()
                  }}
                  title={`${item.label} (${item.icon})`}
                >
                  <div className="admin-icon-card__symbol">
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <span className="admin-icon-card__label">{item.label}</span>
                </button>
              )
            })}

            {filteredIcons.length === 0 && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: 'var(--color-secondary)',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 32, marginBottom: 8, display: 'block' }}
                >
                  search_off
                </span>
                Không tìm thấy biểu tượng nào khớp với từ khóa "{search}".
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
