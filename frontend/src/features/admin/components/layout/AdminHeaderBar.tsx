import type { AdminAccount } from '../../types/admin-auth.types'
import './AdminHeaderBar.css'

interface AdminHeaderBarProps {
  title: string
  account: AdminAccount
  localTime: string
  onOpenMobileMenu: () => void
}

export function AdminHeaderBar({
  title,
  account,
  localTime,
  onOpenMobileMenu,
}: AdminHeaderBarProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  return (
    <header className="admin-header-bar">
      <div className="admin-header-bar__left">
        <button
          type="button"
          className="admin-header-bar__mobile-btn"
          onClick={onOpenMobileMenu}
          aria-label="Mở menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h2 className="admin-header-bar__title">{title}</h2>
      </div>

      <div className="admin-header-bar__right">
        {localTime && <div className="admin-header-bar__clock">{localTime}</div>}

        <div className="admin-header-bar__user-chip">
          <div className="admin-header-bar__avatar-mini">
            {getInitials(account.fullName || account.username)}
          </div>
          <span>{account.fullName}</span>
        </div>
      </div>
    </header>
  )
}
