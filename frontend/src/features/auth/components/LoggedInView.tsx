import lambeLogo from '../../../assets/lambe-logo.svg'
import type { User } from '../types/auth.types'

interface LoggedInViewProps {
  user: User
  onLogout: () => void
}

export function LoggedInView({ user, onLogout }: LoggedInViewProps) {
  return (
    <div className="logged-in-container">
      <div className="brand-showcase__logo-wrapper logged-in-logo">
        <div className="brand-showcase__logo-glow" />
        <img src={lambeLogo} alt="LAMBE Logo" className="brand-showcase__logo-img" />
      </div>

      <div className="logged-in-badge">
        <span className="material-symbols-outlined logged-in-badge__icon">
          check_circle
        </span>
      </div>

      <p className="eyebrow-text">Đăng nhập thành công</p>
      <h1 className="logged-in-title">Xin chào, {user.fullName || 'Bạn'}</h1>
      <p className="logged-in-phone">{user.phone}</p>

      <button type="button" className="logout-btn" onClick={onLogout}>
        <span className="material-symbols-outlined logout-btn__icon">logout</span>
        <span>Đăng xuất</span>
      </button>
    </div>
  )
}
