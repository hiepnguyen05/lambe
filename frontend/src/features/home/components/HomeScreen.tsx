import { useState } from 'react'
import { HomeHeader } from './HomeHeader'
import { LocationCard } from './LocationCard'
import { SearchBar } from './SearchBar'
import { CategoriesGrid } from './CategoriesGrid'
import { HeroBanner } from './HeroBanner'
import { TopSpecialists } from './TopSpecialists'
import { PopularTreatments } from './PopularTreatments'
import { TrustBanner } from './TrustBanner'
import './HomeScreen.css'

interface HomeScreenProps {
  onOpenAccount: () => void
  onBookService?: (serviceName: string) => void
  onNavigateTab?: (tab: 'trang-chu' | 'lich-hen' | 'uu-dai' | 'tin-nhan' | 'tai-khoan') => void
  activeTab?: string
}

export function HomeScreen({
  onOpenAccount,
  onBookService,
  onNavigateTab,
  activeTab = 'trang-chu',
}: HomeScreenProps) {
  const [currentLocation, setCurrentLocation] = useState('Landmark 81, Bình Thạnh')
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [tempLocationInput, setTempLocationInput] = useState('')

  const handleSaveLocation = () => {
    if (tempLocationInput.trim()) {
      setCurrentLocation(tempLocationInput.trim())
    }
    setIsLocationModalOpen(false)
  }

  const handleBookAction = (serviceName: string) => {
    if (onBookService) {
      onBookService(serviceName)
    } else {
      alert(`Bạn chọn đặt dịch vụ: ${serviceName}. Vui lòng đăng nhập để hoàn tất!`)
    }
  }

  return (
    <div className="home-screen-wrapper">
      {/* Fixed Sticky Header */}
      <HomeHeader
        currentLocation={currentLocation}
        onOpenLocationModal={() => {
          setTempLocationInput(currentLocation)
          setIsLocationModalOpen(true)
        }}
        onOpenNotifications={() => alert('Bạn chưa có thông báo mới.')}
        onOpenAccount={onOpenAccount}
        onNavigateTab={onNavigateTab}
        activeTab={activeTab}
      />

      {/* Main Content Area */}
      <main className="home-main-content">
        <div className="home-container">
          {/* Top Hero Banner */}
          <HeroBanner
            onExploreAvailableSpecialists={() =>
              alert('Đang tìm chuyên viên rảnh gần bạn nhất...')
            }
          />

          {/* Search & Location Bar Group */}
          <div className="home-search-row">
            <div className="home-search-col">
              <SearchBar
                onSearch={(query) => {
                  if (query.trim()) {
                    alert(`Tìm kiếm với từ khóa: "${query}"`)
                  }
                }}
                onOpenFilter={() => alert('Bộ lọc dịch vụ sắp ra mắt!')}
              />
            </div>
            <div className="home-location-col">
              <LocationCard
                locationName={currentLocation}
                onOpenLocationModal={() => {
                  setTempLocationInput(currentLocation)
                  setIsLocationModalOpen(true)
                }}
              />
            </div>
          </div>

          {/* Categories Grid */}
          <CategoriesGrid
            onSelectCategory={(catId) => {
              alert(`Xem danh mục: ${catId}`)
            }}
          />

          {/* Desktop Dual-Column Grid Layout (Primary Content | Sidebar) */}
          <div className="home-desktop-grid">
            {/* Primary Main Content */}
            <div className="home-desktop-primary">
              <PopularTreatments
                onBookTreatment={(trId) => handleBookAction(`Liệu trình ${trId}`)}
                onViewAllTreatments={() => alert('Đang xem tất cả dịch vụ phổ biến')}
              />
            </div>

            {/* Desktop Sidebar */}
            <aside className="home-desktop-sidebar">
              <TopSpecialists
                onBookSpecialist={(spId) => handleBookAction(`Thợ mã ${spId}`)}
                onViewAllSpecialists={() => alert('Đang xem toàn bộ 28 thợ gần bạn')}
              />

              <TrustBanner />
            </aside>
          </div>
        </div>
      </main>

      {/* Location Modal Dialog */}
      {isLocationModalOpen && (
        <div className="location-modal-overlay">
          <div className="location-modal-card">
            <div className="location-modal-header">
              <span className="material-symbols-outlined location-modal-icon">
                location_on
              </span>
              <h3 className="location-modal-title">Chọn vị trí phục vụ</h3>
            </div>

            <p className="location-modal-sub">
              Nhập địa chỉ nhà hoặc nơi bạn muốn Lambe phục vụ tận nơi:
            </p>

            <input
              type="text"
              className="location-modal-input"
              placeholder="Ví dụ: Landmark 81, Bình Thạnh"
              value={tempLocationInput}
              onChange={(e) => setTempLocationInput(e.target.value)}
              autoFocus
            />

            <div className="location-modal-actions">
              <button
                type="button"
                className="location-modal-cancel"
                onClick={() => setIsLocationModalOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="location-modal-submit"
                onClick={handleSaveLocation}
              >
                Cập nhật địa chỉ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
