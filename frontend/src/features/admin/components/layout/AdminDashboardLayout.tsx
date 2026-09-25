import { useState } from 'react'
import type { AdminAccount } from '../../types/admin-auth.types'
import { AdminCategoriesTab } from '../categories/AdminCategoriesTab'
import { AdminHeaderBar } from './AdminHeaderBar'
import { AdminSidebar } from './AdminSidebar'
import './AdminDashboardLayout.css'

interface AdminDashboardLayoutProps {
  account: AdminAccount
  localTime: string
  onLogout: () => void
  onShowToast: (title: string, message: string, icon?: string, isError?: boolean) => void
}

const TAB_TITLES: Record<string, string> = {
  dashboard: 'Tổng quan Hệ thống',
  providers: 'Xét duyệt & Quản lý Nhà cung cấp',
  services: 'Quản lý Danh mục & Dịch vụ',
  orders: 'Quản lý Đơn dịch vụ',
  wallets: 'Quản lý Ví & Hoa hồng Sàn',
  users: 'Quản lý Khách hàng',
  'internal-accounts': 'Tài khoản Nội bộ & Phân quyền',
  'audit-logs': 'Nhật ký Hoạt động Audit Log',
  settings: 'Cấu hình Hệ thống',
}

export function AdminDashboardLayout({
  account,
  localTime,
  onLogout,
  onShowToast,
}: AdminDashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState('services')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const activeTitle = TAB_TITLES[activeTab] || 'Quản trị LAMBE'

  return (
    <div
      className={`admin-dashboard-layout ${
        isCollapsed ? 'admin-dashboard-layout--collapsed' : ''
      }`}
    >
      {/* Sidebar Navigation */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        account={account}
        onLogout={onLogout}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Area */}
      <div className="admin-dashboard-layout__main">
        <AdminHeaderBar
          title={activeTitle}
          account={account}
          localTime={localTime}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
        />

        <main className="admin-dashboard-layout__content">
          {activeTab === 'services' && (
            <AdminCategoriesTab onShowToast={onShowToast} />
          )}

          {activeTab === 'dashboard' && (
            <div>
              {/* Overview Metrics Cards */}
              <div className="admin-metrics-grid">
                <div className="admin-metric-card">
                  <div className="admin-metric-card__icon">
                    <span className="material-symbols-outlined">storefront</span>
                  </div>
                  <div className="admin-metric-card__info">
                    <span className="admin-metric-card__label">Hồ sơ chờ duyệt</span>
                    <span className="admin-metric-card__value">3 đơn</span>
                  </div>
                </div>

                <div className="admin-metric-card">
                  <div className="admin-metric-card__icon">
                    <span className="material-symbols-outlined">receipt_long</span>
                  </div>
                  <div className="admin-metric-card__info">
                    <span className="admin-metric-card__label">Tổng đơn tháng này</span>
                    <span className="admin-metric-card__value">1,248</span>
                  </div>
                </div>

                <div className="admin-metric-card">
                  <div className="admin-metric-card__icon">
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                  </div>
                  <div className="admin-metric-card__info">
                    <span className="admin-metric-card__label">Hoa hồng tạm giữ</span>
                    <span className="admin-metric-card__value">42.500.000đ</span>
                  </div>
                </div>

                <div className="admin-metric-card">
                  <div className="admin-metric-card__icon">
                    <span className="material-symbols-outlined">group</span>
                  </div>
                  <div className="admin-metric-card__info">
                    <span className="admin-metric-card__label">Tổng người dùng</span>
                    <span className="admin-metric-card__value">8,920</span>
                  </div>
                </div>
              </div>

              {/* Tab Placeholder */}
              <div className="admin-tab-placeholder">
                <span className="material-symbols-outlined admin-tab-placeholder__icon">
                  analytics
                </span>
                <h3 className="admin-tab-placeholder__title">Bảng điều khiển Báo cáo & Thống kê</h3>
                <p className="admin-tab-placeholder__desc">
                  Hệ thống đang hoạt động bình thường. Bạn có 3 hồ sơ nhà cung cấp đang chờ xét duyệt trong hàng đợi.
                </p>
              </div>
            </div>
          )}

          {activeTab !== 'dashboard' && activeTab !== 'services' && (
            <div className="admin-tab-placeholder">
              <span className="material-symbols-outlined admin-tab-placeholder__icon">
                {activeTab === 'providers'
                  ? 'storefront'
                  : activeTab === 'orders'
                  ? 'receipt_long'
                  : activeTab === 'wallets'
                  ? 'account_balance_wallet'
                  : activeTab === 'users'
                  ? 'group'
                  : activeTab === 'internal-accounts'
                  ? 'shield_person'
                  : activeTab === 'audit-logs'
                  ? 'history_toggle_off'
                  : 'settings'}
              </span>
              <h3 className="admin-tab-placeholder__title">{activeTitle}</h3>
              <p className="admin-tab-placeholder__desc">
                Module nghiệp vụ <strong>{activeTitle}</strong> được kết nối với hệ thống quyền <code>{account.roles.join(', ')}</code>.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

