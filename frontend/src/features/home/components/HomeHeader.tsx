import lambeLogo from '../../../assets/lambe-logo.svg'
import type { TabKey } from '../../../types/navigation.types'

interface HomeHeaderProps {
  currentLocation: string
  onOpenLocationModal: () => void
  onOpenNotifications: () => void
  onOpenAccount: () => void
  onNavigateTab?: (tab: TabKey) => void
  activeTab?: string
  hasUnreadNotifications?: boolean
}

export function HomeHeader({
  currentLocation,
  onOpenLocationModal,
  onOpenNotifications,
  onOpenAccount,
  onNavigateTab,
  activeTab = 'trang-chu',
  hasUnreadNotifications = false,
}: HomeHeaderProps) {
  return (
    <header className="home-header">
      <div className="home-header__inner">
        {/* Brand & Location */}
        <div className="home-header__left">
          <button
            type="button"
            className="home-header__brand-btn"
            onClick={() => onNavigateTab?.('trang-chu')}
          >
            <img
              src={lambeLogo}
              alt="LAMBE Logo"
              className="home-header__logo"
            />
            <span className="home-header__brand-name">LAMBE</span>
          </button>

          <span className="home-header__divider">|</span>

          {/* Location Trigger */}
          <button
            type="button"
            className="home-header__location-btn"
            aria-label="Chọn vị trí phục vụ"
            onClick={onOpenLocationModal}
          >
            <span className="material-symbols-outlined home-header__loc-icon">
              location_on
            </span>
            <span className="home-header__loc-text">{currentLocation}</span>
            <span className="material-symbols-outlined home-header__arrow-icon">
              keyboard_arrow_down
            </span>
          </button>
        </div>

        {/* Desktop Navigation Links (hidden on mobile, visible on desktop) */}
        <nav className="home-header__desktop-nav">
          <button
            type="button"
            className={`desktop-nav-link ${
              activeTab === 'trang-chu' ? 'desktop-nav-link--active' : ''
            }`}
            onClick={() => onNavigateTab?.('trang-chu')}
          >
            Trang chủ
          </button>
          <button
            type="button"
            className={`desktop-nav-link ${
              activeTab === 'lich-hen' ? 'desktop-nav-link--active' : ''
            }`}
            onClick={() => onNavigateTab?.('lich-hen')}
          >
            Lịch hẹn
          </button>
          <button
            type="button"
            className={`desktop-nav-link ${
              activeTab === 'uu-dai' ? 'desktop-nav-link--active' : ''
            }`}
            onClick={() => onNavigateTab?.('uu-dai')}
          >
            Ưu đãi & Khuyến mãi
          </button>
          <button
            type="button"
            className={`desktop-nav-link ${
              activeTab === 'tin-nhan' ? 'desktop-nav-link--active' : ''
            }`}
            onClick={() => onNavigateTab?.('tin-nhan')}
          >
            Tin nhắn
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="home-header__right">
          <button
            type="button"
            className="home-header__icon-btn"
            aria-label="Thông báo"
            onClick={onOpenNotifications}
          >
            <span className="material-symbols-outlined">notifications</span>
            {hasUnreadNotifications && (
              <span className="home-header__notif-badge" />
            )}
          </button>

          <button
            type="button"
            className="home-header__account-btn"
            onClick={onOpenAccount}
          >
            <div className="home-header__avatar-circle">
              <span className="material-symbols-outlined">person</span>
            </div>
            <span className="home-header__account-text">Tài khoản</span>
          </button>
        </div>
      </div>
    </header>
  )
}
