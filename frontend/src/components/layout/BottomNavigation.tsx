export type TabKey = 'trang-chu' | 'lich-hen' | 'uu-dai' | 'tin-nhan' | 'tai-khoan'

interface BottomNavigationProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  unreadMessagesCount?: number
}

interface NavItem {
  key: TabKey
  label: string
  icon: string
  hasBadge?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'trang-chu', label: 'Trang chủ', icon: 'home' },
  { key: 'lich-hen', label: 'Lịch hẹn', icon: 'calendar_month' },
  { key: 'uu-dai', label: 'Ưu đãi', icon: 'local_offer' },
  { key: 'tin-nhan', label: 'Tin nhắn', icon: 'chat_bubble', hasBadge: true },
  { key: 'tai-khoan', label: 'Tài khoản', icon: 'person' },
]

export function BottomNavigation({
  activeTab,
  onTabChange,
  unreadMessagesCount = 1,
}: BottomNavigationProps) {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav__container">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.key

          return (
            <button
              key={item.key}
              type="button"
              className={`bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
              onClick={() => onTabChange(item.key)}
            >
              <div className="bottom-nav__icon-wrapper">
                <span
                  className="material-symbols-outlined bottom-nav__icon"
                  style={{
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {item.icon}
                </span>

                {item.hasBadge && unreadMessagesCount > 0 && !isActive && (
                  <span className="bottom-nav__badge-dot" />
                )}
              </div>

              <span className="bottom-nav__label">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
