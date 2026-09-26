import { useState } from 'react'

export interface BeautyIconItem {
  icon: string
  label: string
  keywords: string // Tiếng Việt và Tiếng Anh để tìm kiếm
  group: 'hair' | 'nail' | 'makeup' | 'spa' | 'vip' | 'ops'
}

export const BEAUTY_ICON_GROUPS = [
  { id: 'all', label: 'Tất cả', icon: 'grid_view' },
  { id: 'hair', label: 'Tóc & Salon', icon: 'content_cut' },
  { id: 'nail', label: 'Nail & Móng', icon: 'back_hand' },
  { id: 'makeup', label: 'Trang điểm', icon: 'face_3' },
  { id: 'spa', label: 'Spa & Skincare', icon: 'spa' },
  { id: 'vip', label: 'Dịch vụ VIP', icon: 'crown' },
  { id: 'ops', label: 'Salon & Vận hành', icon: 'storefront' },
]

function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

export const EXPANDED_BEAUTY_ICONS: BeautyIconItem[] = [
  // Tóc & Salon (Hair & Barber)
  { icon: 'content_cut', label: 'Cắt tóc nam/nữ', keywords: 'cat toc keo cat tao kieu barber haircut shears scissors', group: 'hair' },
  { icon: 'styler', label: 'Sấy & Tạo kiểu', keywords: 'say toc tao kieu uon luon vuot sap styling styler', group: 'hair' },
  { icon: 'dry', label: 'Máy sấy tóc', keywords: 'may say toc nhuom kho blow dry dryer', group: 'hair' },
  { icon: 'shower', label: 'Gội đầu dưỡng sinh', keywords: 'goi dau xa toc voi sen tam wash hair shower', group: 'hair' },
  { icon: 'brush', label: 'Nhuộm màu & Cọ chải', keywords: 'nhuom mau co chai luoc nhuom color brush', group: 'hair' },
  { icon: 'design_services', label: 'Thiết kế mẫu tóc', keywords: 'thiet ke phom toc mau toc barber design', group: 'hair' },
  { icon: 'face_6', label: 'Cạo râu & Tỉa râu', keywords: 'cao rau tia rau barber beard shave men', group: 'hair' },
  { icon: 'face_2', label: 'Tóc nữ dài & Uốn duỗi', keywords: 'toc nu uon duoi toc dai women hair', group: 'hair' },
  { icon: 'chair', label: 'Ghế cắt tóc Salon', keywords: 'ghe salon ghe cat toc barber chair', group: 'hair' },
  { icon: 'cut', label: 'Kéo tỉa tóc', keywords: 'keo cat keo tia scissor cut', group: 'hair' },

  // Nail & Móng (Nail & Hands/Feet)
  { icon: 'back_hand', label: 'Sơn móng & Nailart', keywords: 'son mong ban tay nailart gel hand', group: 'nail' },
  { icon: 'handyman', label: 'Chăm sóc & Nhặt da móng', keywords: 'cham soc mong nhat da cat mong manicure pedicure', group: 'nail' },
  { icon: 'palette', label: 'Bảng màu sơn móng', keywords: 'bang mau son phoi mau nail palette color', group: 'nail' },
  { icon: 'clean_hands', label: 'Dưỡng da tay', keywords: 'duong tay kem tay tay da chet clean hands', group: 'nail' },
  { icon: 'front_hand', label: 'Sơn móng chân & Tay', keywords: 'son mong chan mong tay pedicure front hand', group: 'nail' },
  { icon: 'fingerprint', label: 'Vẽ hoa văn móng', keywords: 've mong hoa van fingerprint detail', group: 'nail' },

  // Trang điểm & Mi (Makeup & Facial Aesthetics)
  { icon: 'face_3', label: 'Trang điểm dự tiệc', keywords: 'trang diem makeup du tiec khuon mat nu party face', group: 'makeup' },
  { icon: 'face_5', label: 'Trang điểm cô dâu', keywords: 'co dau makeup co dau trang diem nghe thuat bride', group: 'makeup' },
  { icon: 'face_4', label: 'Chăm sóc da mặt / Skincare', keywords: 'da mat mat na skincare facial mask', group: 'makeup' },
  { icon: 'flare', label: 'Đánh khối & Highlight', keywords: 'danh khoi bat sang highlight phu bong flare', group: 'makeup' },
  { icon: 'magic_button', label: 'Phun xăm thẩm mỹ', keywords: 'phun xam dieu khac may moi magic tattoo', group: 'makeup' },
  { icon: 'photo_camera_front', label: 'Makeup chụp ảnh / Studio', keywords: 'makeup chup anh studio quay phim camera', group: 'makeup' },
  { icon: 'visibility', label: 'Nối mi & Uốn mi', keywords: 'noi mi uon mi xam mi mat eyelash lash eye', group: 'makeup' },
  { icon: 'face_retouching_natural', label: 'Trị mụn & Tái tạo da', keywords: 'tri mun tri nam lam min da retouching skin', group: 'makeup' },

  // Spa & Body
  { icon: 'spa', label: 'Spa & Thư giãn', keywords: 'spa thu gian thao moc body massage', group: 'spa' },
  { icon: 'self_care', label: 'Massage ấn huyệt', keywords: 'massage bam huyet body self care', group: 'spa' },
  { icon: 'water_drop', label: 'Cấp ẩm & Serum', keywords: 'cap am serum duong am xit khoang water drop', group: 'spa' },
  { icon: 'sanitizer', label: 'Tẩy da chết & Detox', keywords: 'tay da chet detox body sanitizer', group: 'spa' },
  { icon: 'soap', label: 'Tắm trắng & Tắm dưỡng', keywords: 'tam trang sua tam xa phong duong da soap', group: 'spa' },
  { icon: 'hot_tub', label: 'Xông hơi & Ngâm chân', keywords: 'xong hoi ngam chan bon tam thao duoc hot tub', group: 'spa' },
  { icon: 'nature_people', label: 'Massage cổ vai gáy', keywords: 'duong sinh co vai gay massage nature', group: 'spa' },
  { icon: 'healing', label: 'Trị liệu & Phục hồi da', keywords: 'tri lieu phuc hoi da healing repair', group: 'spa' },
  { icon: 'fitness_center', label: 'Giảm béo & Định hình', keywords: 'giam beo dot mo dinh hinh body fitness', group: 'spa' },

  // VIP & Đặc Quyền (VIP & Premium Deals)
  { icon: 'crown', label: 'Gói VIP Hoàng Gia', keywords: 'vip hoang gia vuong mien premium crown', group: 'vip' },
  { icon: 'diamond', label: 'Dịch vụ Kim Cương', keywords: 'kim cuong cao cap sang trong diamond luxury', group: 'vip' },
  { icon: 'auto_awesome', label: 'Thẩm mỹ công nghệ cao', keywords: 'cong nghe cao laser nang co auto awesome', group: 'vip' },
  { icon: 'verified', label: 'Dịch vụ Đạt chuẩn', keywords: 'dat chuan xac minh uy tin verified', group: 'vip' },
  { icon: 'award_star', label: 'Dịch vụ Bán chạy', keywords: 'ban chay hot giai thuong award star', group: 'vip' },
  { icon: 'local_fire_department', label: 'Dịch vụ HOT nhất', keywords: 'hot khuyen mai giam gia fire deal', group: 'vip' },
  { icon: 'favorite', label: 'Dịch vụ Yêu thích', keywords: 'yeu thich tim uu chuong favorite heart', group: 'vip' },
  { icon: 'eco', label: 'Thảo mộc Organic', keywords: 'organic thien nhien huu co eco herbal', group: 'vip' },
  { icon: 'florist', label: 'Tinh dầu thiên nhiên', keywords: 'tinh dau huong thom hoa florist aroma', group: 'vip' },
  { icon: 'star', label: 'Dịch vụ 5 Sao', keywords: '5 sao chat luong vang star rating', group: 'vip' },
  { icon: 'bolt', label: 'Làm đẹp Cấp tốc', keywords: 'cap toc lay ngay nhanh bolt fast', group: 'vip' },
  { icon: 'card_giftcard', label: 'Voucher & Quà tặng', keywords: 'qua tang voucher giftcard uu dai', group: 'vip' },

  // Salon & Vận hành (Operations & Facilities)
  { icon: 'storefront', label: 'Salon / Tiệm làm đẹp', keywords: 'salon cua hang tiem storefront shop', group: 'ops' },
  { icon: 'location_on', label: 'Địa điểm tận nhà', keywords: 'dia diem tan nha vi tri map location', group: 'ops' },
  { icon: 'schedule', label: 'Đặt lịch hẹn', keywords: 'dat lich thoi gian lich hen schedule time appointment', group: 'ops' },
  { icon: 'account_balance_wallet', label: 'Thanh toán & Ví', keywords: 'vi thanh toan tien mat wallet money payment', group: 'ops' },
  { icon: 'group', label: 'Đội ngũ thợ', keywords: 'tho nhan vien ky thuat vien team staff group', group: 'ops' },
  { icon: 'home_repair_service', label: 'Dịch vụ tại nhà', keywords: 'tai nha luu dong tan nha home service', group: 'ops' },
  { icon: 'local_shipping', label: 'Thợ di chuyển', keywords: 'di chuyen tho di chuyen shipping delivery', group: 'ops' },
  { icon: 'shield', label: 'Bảo hiểm & An toàn', keywords: 'bao hiem an toan bao ve shield safety', group: 'ops' },
  { icon: 'thumb_up', label: 'Đánh giá hài lòng', keywords: 'hai long thich khen thumb up review', group: 'ops' },
  { icon: 'phone_in_talk', label: 'Tư vấn Hotline', keywords: 'tu van hotline dien thoai phone support', group: 'ops' },
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

  const normalizedSearch = removeAccents(search.trim())
  const cleanSearchKey = search.trim().toLowerCase().replace(/\s+/g, '_')

  const filteredIcons = EXPANDED_BEAUTY_ICONS.filter((item) => {
    const matchesGroup = activeGroup === 'all' || item.group === activeGroup

    if (!normalizedSearch) return matchesGroup

    const itemLabelNorm = removeAccents(item.label)
    const itemKeywordsNorm = removeAccents(item.keywords)
    const itemIconNorm = removeAccents(item.icon)

    const matchesSearch =
      itemLabelNorm.includes(normalizedSearch) ||
      itemKeywordsNorm.includes(normalizedSearch) ||
      itemIconNorm.includes(normalizedSearch)

    return matchesGroup && matchesSearch
  })

  // Check if current search query exact key is already present in filtered list
  const isExactKeyInList = filteredIcons.some((i) => i.icon === cleanSearchKey)
  const showDynamicCard = Boolean(cleanSearchKey && !isExactKeyInList && /^[a-z0-9_]+$/.test(cleanSearchKey))

  return (
    <div className="admin-icon-modal-backdrop" onClick={onClose}>
      <div className="admin-icon-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-icon-modal__header">
          <h3 className="admin-icon-modal__title">
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>
              auto_awesome
            </span>
            Chọn Biểu Tượng Dịch Vụ
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
              placeholder="Tìm theo tên dịch vụ (VD: cắt tóc, sấy, làm móng, spa...) hoặc từ khóa tiếng Anh bất kỳ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Group Filter Tabs */}
          <div className="admin-icon-modal__tabs" style={{ flexWrap: 'wrap', gap: 6 }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {group.icon}
                  </span>
                  {group.label}
                </button>
              )
            })}
          </div>

          {/* Rich Icon Grid */}
          <div className="admin-icon-rich-grid" style={{ maxHeight: 360, overflowY: 'auto', marginTop: 12 }}>
            {/* Dynamic Card Preview when typing any Google Material Symbol keyword */}
            {showDynamicCard && (
              <button
                type="button"
                className={`admin-icon-card ${
                  selectedIcon === cleanSearchKey ? 'admin-icon-card--active' : ''
                }`}
                style={{
                  border: '2px dashed var(--color-primary)',
                  background: 'rgba(var(--color-primary-rgb, 103, 80, 164), 0.05)',
                }}
                onClick={() => {
                  onSelectIcon(cleanSearchKey)
                  onClose()
                }}
                title={`Biểu tượng mới: ${cleanSearchKey}`}
              >
                <div className="admin-icon-card__symbol">
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>
                    {cleanSearchKey}
                  </span>
                </div>
                <span className="admin-icon-card__label" style={{ fontWeight: 600 }}>
                  Dùng biểu tượng "{search.trim()}"
                </span>
              </button>
            )}

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
                  title={item.label}
                >
                  <div className="admin-icon-card__symbol">
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <span className="admin-icon-card__label">{item.label}</span>
                </button>
              )
            })}

            {filteredIcons.length === 0 && !showDynamicCard && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '40px 16px',
                  color: 'var(--color-secondary)',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 36, marginBottom: 8, display: 'block', color: 'var(--color-outline)' }}
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
