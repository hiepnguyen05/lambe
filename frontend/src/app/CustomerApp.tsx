import { useState } from 'react'
import { BottomNavigation } from '../components/layout/BottomNavigation'
import '../components/layout/BottomNavigation.css'
import { AuthScreen } from '../features/auth/components/AuthScreen'
import { HomeScreen } from '../features/home/components/HomeScreen'
import type { TabKey } from '../types/navigation.types'
import { TabPlaceholder } from './TabPlaceholder'

const PLACEHOLDERS: Partial<
  Record<
    TabKey,
    { icon: string; title: string; description: string; actionLabel: string }
  >
> = {
  'lich-hen': {
    icon: 'calendar_month',
    title: 'Lịch hẹn của bạn',
    description: 'Bạn chưa có lịch hẹn làm đẹp nào sắp tới.',
    actionLabel: 'Đặt lịch làm đẹp ngay',
  },
  'uu-dai': {
    icon: 'local_offer',
    title: 'Ưu đãi & Voucher',
    description: 'Các ưu đãi phù hợp với bạn sẽ xuất hiện tại đây.',
    actionLabel: 'Khám phá dịch vụ',
  },
  'tin-nhan': {
    icon: 'chat_bubble',
    title: 'Tin nhắn & Trò chuyện',
    description: 'Các cuộc trao đổi với chuyên viên sẽ xuất hiện tại đây.',
    actionLabel: 'Quay lại Trang chủ',
  },
}

export function CustomerApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('trang-chu')
  const placeholder = PLACEHOLDERS[activeTab]

  return (
    <div className="app-main-layout">
      {activeTab === 'trang-chu' && (
        <HomeScreen
          activeTab={activeTab}
          onBookService={() => setActiveTab('tai-khoan')}
          onNavigateTab={setActiveTab}
          onOpenAccount={() => setActiveTab('tai-khoan')}
        />
      )}

      {activeTab === 'tai-khoan' && <AuthScreen />}

      {placeholder && (
        <TabPlaceholder
          {...placeholder}
          onAction={() => setActiveTab('trang-chu')}
        />
      )}

      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
