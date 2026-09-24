import { useState } from 'react'
import { HomeScreen } from './features/home/components/HomeScreen'
import { AuthScreen } from './features/auth/components/AuthScreen'
import {
  BottomNavigation,
  type TabKey,
} from './components/layout/BottomNavigation'
import './components/layout/BottomNavigation.css'

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('trang-chu')

  const handleOpenAccount = () => {
    setActiveTab('tai-khoan')
  }

  const handleBookService = (serviceName: string) => {
    alert(`Đã chọn: ${serviceName}. Bạn đang được chuyển hướng tới trang Đăng nhập / Tài khoản.`)
    setActiveTab('tai-khoan')
  }

  return (
    <div className="app-main-layout">
      {activeTab === 'trang-chu' && (
        <HomeScreen
          onOpenAccount={handleOpenAccount}
          onBookService={handleBookService}
          onNavigateTab={setActiveTab}
          activeTab={activeTab}
        />
      )}

      {activeTab === 'tai-khoan' && <AuthScreen />}

      {activeTab === 'lich-hen' && (
        <main className="tab-placeholder-main">
          <div className="tab-placeholder-card">
            <span className="material-symbols-outlined tab-placeholder-icon">
              calendar_month
            </span>
            <h2 className="tab-placeholder-title">Lịch hẹn của bạn</h2>
            <p className="tab-placeholder-sub">
              Bạn chưa có lịch hẹn làm đẹp nào sắp tới.
            </p>
            <button
              type="button"
              className="tab-placeholder-btn"
              onClick={() => setActiveTab('trang-chu')}
            >
              Đặt lịch làm đẹp ngay
            </button>
          </div>
        </main>
      )}

      {activeTab === 'uu-dai' && (
        <main className="tab-placeholder-main">
          <div className="tab-placeholder-card">
            <span className="material-symbols-outlined tab-placeholder-icon">
              local_offer
            </span>
            <h2 className="tab-placeholder-title">Ưu đãi & Voucher</h2>
            <p className="tab-placeholder-sub">
              Nhận voucher giảm 20% cho lần đặt dịch vụ đầu tiên!
            </p>
            <button
              type="button"
              className="tab-placeholder-btn"
              onClick={() => setActiveTab('trang-chu')}
            >
              Khám phá dịch vụ HOT
            </button>
          </div>
        </main>
      )}

      {activeTab === 'tin-nhan' && (
        <main className="tab-placeholder-main">
          <div className="tab-placeholder-card">
            <span className="material-symbols-outlined tab-placeholder-icon">
              chat_bubble
            </span>
            <h2 className="tab-placeholder-title">Tin nhắn & Trò chuyện</h2>
            <p className="tab-placeholder-sub">
              Trao đổi trực tiếp với thợ làm đẹp về yêu cầu dịch vụ của bạn.
            </p>
            <button
              type="button"
              className="tab-placeholder-btn"
              onClick={() => setActiveTab('trang-chu')}
            >
              Quay lại Trang chủ
            </button>
          </div>
        </main>
      )}

      {/* Bottom Navigation (Hidden on Desktop, Visible on Mobile/Tablet) */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
