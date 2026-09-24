export function TrustBanner() {
  return (
    <section className="trust-banner-section">
      <div className="trust-banner-card">
        <div className="trust-item">
          <span className="material-symbols-outlined trust-icon">
            sanitizer
          </span>
          <span className="trust-text">100% Vô trùng</span>
        </div>

        <div className="trust-divider" />

        <div className="trust-item">
          <span className="material-symbols-outlined trust-icon">
            shield_person
          </span>
          <span className="trust-text">KTV lý lịch rõ ràng</span>
        </div>

        <div className="trust-divider" />

        <div className="trust-item">
          <span className="material-symbols-outlined trust-icon">
            schedule
          </span>
          <span className="trust-text">Đúng giờ tận tâm</span>
        </div>
      </div>
    </section>
  )
}
