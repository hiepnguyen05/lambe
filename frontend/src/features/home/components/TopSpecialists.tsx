interface Specialist {
  id: string
  name: string
  role: string
  rating: number
  distance: string
  highlight: string
  priceFrom: string
  avatar: string
  isVerified?: boolean
}

const SPECIALISTS: Specialist[] = [
  {
    id: 'sp-1',
    name: 'Kim Chi',
    role: 'Master Nail',
    rating: 4.9,
    distance: 'Cách 1.2 km',
    highlight: 'Dụng cụ vô trùng seal y tế',
    priceFrom: 'Từ 180k',
    avatar:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250',
    isVerified: true,
  },
  {
    id: 'sp-2',
    name: 'Hoàng Nam',
    role: 'KTV Trị Liệu',
    rating: 5.0,
    distance: 'Cách 2.4 km',
    highlight: 'Mang nệm gấp & đá nóng',
    priceFrom: 'Từ 299k',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
    isVerified: true,
  },
]

interface TopSpecialistsProps {
  onBookSpecialist?: (specialistId: string) => void
  onViewAllSpecialists?: () => void
}

export function TopSpecialists({
  onBookSpecialist,
  onViewAllSpecialists,
}: TopSpecialistsProps) {
  return (
    <section className="specialists-section">
      <div className="section-header">
        <div className="specialists-title-group">
          <h2 className="section-title">Thợ uy tín gần bạn</h2>
          <span className="live-pulse-dot" />
        </div>

        <button
          type="button"
          className="section-link-btn"
          onClick={onViewAllSpecialists}
        >
          <span>Xem 28 thợ</span>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      <div className="specialists-list">
        {SPECIALISTS.map((sp) => (
          <div key={sp.id} className="specialist-card">
            <div className="specialist-card__left">
              <div className="specialist-avatar-box">
                <img
                  src={sp.avatar}
                  alt={sp.name}
                  className="specialist-avatar"
                />
                {sp.isVerified && (
                  <div className="specialist-verified-badge" title="Đã xác minh">
                    <span className="material-symbols-outlined">verified</span>
                  </div>
                )}
              </div>

              <div className="specialist-info">
                <div className="specialist-name-row">
                  <h3 className="specialist-name">{sp.name}</h3>
                  <span className="specialist-role">• {sp.role}</span>
                </div>

                <div className="specialist-meta-row">
                  <span className="specialist-rating">
                    <span
                      className="material-symbols-outlined star-icon"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                    <span>{sp.rating.toFixed(1)}</span>
                  </span>
                  <span className="meta-dot">•</span>
                  <span className="specialist-distance">{sp.distance}</span>
                </div>

                <p className="specialist-highlight">{sp.highlight}</p>
              </div>
            </div>

            <div className="specialist-card__right">
              <span className="specialist-price">{sp.priceFrom}</span>
              <button
                type="button"
                className="specialist-book-btn"
                onClick={() => onBookSpecialist?.(sp.id)}
              >
                Đặt lịch
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
