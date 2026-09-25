interface HeroBannerProps {
  onExploreAvailableSpecialists?: () => void
}

export function HeroBanner({
  onExploreAvailableSpecialists,
}: HeroBannerProps) {
  return (
    <section className="hero-banner-section">
      <div className="hero-banner">
        <div className="hero-banner__left">
          <div className="hero-banner__badge">
            <span className="hero-banner__pulse-dot" />
            <span>Có thợ sẵn sàng phục vụ ngay</span>
          </div>

          <h1 className="hero-banner__title">
            Dịch vụ làm đẹp tận nơi chuyên nghiệp
          </h1>

          <p className="hero-banner__subtitle">
            Chuyên viên đến tận nhà sau 30-45 phút. Trải nghiệm trọn vẹn quy trình
            thư giãn & chăm sóc sắc đẹp chuẩn Spa ngay tại không gian sống của bạn.
          </p>

          <div className="hero-banner__actions">
            <button
              type="button"
              className="hero-banner__cta-btn"
              onClick={onExploreAvailableSpecialists}
            >
              <span className="material-symbols-outlined">near_me</span>
              <span>Tìm thợ rảnh quanh đây</span>
            </button>

            <div className="hero-banner__trust-mini">
              <span className="material-symbols-outlined hero-banner__verified-icon">
                verified
              </span>
              <span>100% Dụng cụ vô trùng y tế</span>
            </div>
          </div>
        </div>

        {/* Desktop Interactive Feature Card / Visual Accent */}
        <div className="hero-banner__right">
          <div className="hero-card-preview">
            <div className="hero-card-preview__header">
              <div className="hero-card-preview__badge">HOT</div>
              <span className="hero-card-preview__title">Dịch vụ được yêu thích</span>
            </div>

            <div className="hero-card-preview__item">
              <span className="material-symbols-outlined hero-card-preview__icon">spa</span>
              <div>
                <strong>Gội Dưỡng Sinh & Cổ Vai Gáy</strong>
                <p>Thư giãn sâu với thảo dược tự nhiên</p>
              </div>
              <span className="hero-card-preview__price">289k</span>
            </div>

            <div className="hero-card-preview__item">
              <span className="material-symbols-outlined hero-card-preview__icon">brush</span>
              <div>
                <strong>Combo Nail Nàng Thơ</strong>
                <p>Cắt da + Sơn Gel Hàn Quốc</p>
              </div>
              <span className="hero-card-preview__price">245k</span>
            </div>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="hero-banner__glow-circle" />
        <span className="material-symbols-outlined hero-banner__bg-icon">
          spa
        </span>
      </div>
    </section>
  )
}
