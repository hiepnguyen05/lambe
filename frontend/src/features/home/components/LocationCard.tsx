interface LocationCardProps {
  locationName: string
  onOpenLocationModal: () => void
}

export function LocationCard({
  locationName,
  onOpenLocationModal,
}: LocationCardProps) {
  return (
    <section className="location-card-section">
      <div className="location-card">
        <div className="location-card__left">
          <div className="location-card__icon-box">
            <span
              className="material-symbols-outlined location-card__pin-icon"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              home_pin
            </span>
          </div>

          <div className="location-card__info">
            <div className="location-card__subtitle">
              <span>Giao dịch vụ đến tận nơi</span>
              <span className="location-card__online-dot" />
            </div>
            <div className="location-card__title">{locationName}</div>
          </div>
        </div>

        <button
          type="button"
          className="location-card__change-btn"
          onClick={onOpenLocationModal}
        >
          <span>Đổi</span>
          <span className="material-symbols-outlined">tune</span>
        </button>
      </div>
    </section>
  )
}
