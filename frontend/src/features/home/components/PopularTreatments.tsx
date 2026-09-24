interface Treatment {
  id: string
  title: string
  duration: string
  price: string
  image: string
}

const TREATMENTS: Treatment[] = [
  {
    id: 'tr-1',
    title: 'Gội Dưỡng Sinh & Thải Độc Cổ Vai Gáy',
    duration: '75 phút',
    price: '289.000đ',
    image:
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=300',
  },
  {
    id: 'tr-2',
    title: 'Combo Cắt Da + Sơn Gel + Massage Tay',
    duration: '60 phút',
    price: '245.000đ',
    image:
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=80&w=300',
  },
]

interface PopularTreatmentsProps {
  onBookTreatment?: (treatmentId: string) => void
  onViewAllTreatments?: () => void
}

export function PopularTreatments({
  onBookTreatment,
  onViewAllTreatments,
}: PopularTreatmentsProps) {
  return (
    <section className="treatments-section">
      <div className="section-header">
        <h2 className="section-title">Dịch vụ tận nhà phổ biến</h2>
        <button
          type="button"
          className="section-link-btn"
          onClick={onViewAllTreatments}
        >
          <span>Xem tất cả</span>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      <div className="treatments-list">
        {TREATMENTS.map((tr) => (
          <div key={tr.id} className="treatment-card">
            <img src={tr.image} alt={tr.title} className="treatment-image" />

            <div className="treatment-content">
              <div className="treatment-meta">
                <span className="material-symbols-outlined clock-icon">
                  schedule
                </span>
                <span>{tr.duration}</span>
              </div>

              <h3 className="treatment-title">{tr.title}</h3>

              <div className="treatment-footer">
                <span className="treatment-price">{tr.price}</span>
                <button
                  type="button"
                  className="treatment-book-btn"
                  onClick={() => onBookTreatment?.(tr.id)}
                >
                  Đặt ngay
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
