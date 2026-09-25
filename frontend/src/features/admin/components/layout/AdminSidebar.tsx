import lambeLogo from '../../../../assets/lambe-logo.svg'
import type { AdminAccount } from '../../types/admin-auth.types'
import './AdminSidebar.css'

export interface NavItemConfig {
  id: string
  label: string
  icon: string
  badge?: number | string
  badgeTone?: 'primary' | 'warning'
}

export interface NavSectionConfig {
  title: string
  items: NavItemConfig[]
}

const NAV_SECTIONS: NavSectionConfig[] = [
  {
    title: 'Tổng quan',
    items: [
      { id: 'dashboard', label: 'Tổng quan', icon: 'dashboard' },
    ],
  },
  {
    title: 'Nghiệp vụ Sàn',
    items: [
      {
        id: 'providers',
        label: 'Duyệt Nhà cung cấp',
        icon: 'storefront',
        badge: 3,
        badgeTone: 'warning',
      },
      { id: 'services', label: 'Danh mục & Dịch vụ', icon: 'category' },
      { id: 'orders', label: 'Quản lý Đơn hàng', icon: 'receipt_long' },
      { id: 'wallets', label: 'Ví & Hoa hồng', icon: 'account_balance_wallet' },
    ],
  },
  {
    title: 'Hệ thống & Bảo mật',
    items: [
      { id: 'users', label: 'Quản lý Khách hàng', icon: 'group' },
      { id: 'internal-accounts', label: 'Tài khoản Nội bộ', icon: 'shield_person' },
      { id: 'audit-logs', label: 'Nhật ký Audit Log', icon: 'history_toggle_off' },
      { id: 'settings', label: 'Cấu hình Hệ thống', icon: 'settings' },
    ],
  },
]

interface AdminSidebarProps {
  activeTab: string
  onSelectTab: (tabId: string) => void
  account: AdminAccount
  onLogout: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobileOpen: boolean
  onCloseMobile: () => void
}

export function AdminSidebar({
  activeTab,
  onSelectTab,
  account,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: AdminSidebarProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`admin-sidebar-backdrop ${
          isMobileOpen ? 'admin-sidebar-backdrop--open' : ''
        }`}
        onClick={onCloseMobile}
      />

      <aside
        className={`admin-sidebar ${isCollapsed ? 'admin-sidebar--collapsed' : ''} ${
          isMobileOpen ? 'admin-sidebar--mobile-open' : ''
        }`}
      >
        {/* Header / Brand */}
        <div className="admin-sidebar__header">
          <div className="admin-sidebar__brand">
            <img src={lambeLogo} alt="LAMBE" className="admin-sidebar__logo" />
            <div className="admin-sidebar__title-box">
              <span className="admin-sidebar__brand-name">LAMBE Admin</span>
              <span className="admin-sidebar__brand-badge">Internal Portal</span>
            </div>
          </div>

          <button
            type="button"
            className="admin-sidebar__toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            aria-label={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            <span className="material-symbols-outlined">
              {isCollapsed ? 'side_navigation' : 'menu_open'}
            </span>
          </button>
        </div>

        {/* Nav Items */}
        <nav className="admin-sidebar__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="admin-sidebar__section">
              <span className="admin-sidebar__section-title">{section.title}</span>
              {section.items.map((item) => {
                const isActive = activeTab === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`admin-sidebar__nav-item ${
                      isActive ? 'admin-sidebar__nav-item--active' : ''
                    }`}
                    onClick={() => {
                      onSelectTab(item.id)
                      onCloseMobile()
                    }}
                  >
                    <span className="material-symbols-outlined admin-sidebar__icon">
                      {item.icon}
                    </span>
                    <span className="admin-sidebar__label">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`admin-sidebar__nav-badge ${
                          item.badgeTone === 'warning'
                            ? 'admin-sidebar__nav-badge--warning'
                            : 'admin-sidebar__nav-badge--primary'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user">
            <div className="admin-sidebar__avatar">
              {getInitials(account.fullName || account.username)}
            </div>
            <div className="admin-sidebar__user-info">
              <span className="admin-sidebar__user-name">{account.fullName}</span>
              <span className="admin-sidebar__user-role">
                {account.roles.join(', ') || 'Internal Member'}
              </span>
            </div>
            <button
              type="button"
              className="admin-sidebar__logout-btn"
              onClick={onLogout}
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
