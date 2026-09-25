import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { TabKey } from '../../../types/navigation.types'
import { CategoriesGrid } from './CategoriesGrid'
import { HeroBanner } from './HeroBanner'
import { HomeHeader } from './HomeHeader'
import { LocationCard } from './LocationCard'
import { PopularTreatments } from './PopularTreatments'
import { SearchBar } from './SearchBar'
import { TopSpecialists } from './TopSpecialists'
import { TrustBanner } from './TrustBanner'
import './HomeScreen.css'

interface HomeScreenProps {
  onOpenAccount: () => void
  onBookService: (serviceName: string) => void
  onNavigateTab: (tab: TabKey) => void
  activeTab: TabKey
}

export function HomeScreen({
  onOpenAccount,
  onBookService,
  onNavigateTab,
  activeTab,
}: HomeScreenProps) {
  const [currentLocation, setCurrentLocation] = useState('Landmark 81, Bình Thạnh')
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [tempLocationInput, setTempLocationInput] = useState('')
  const [notice, setNotice] = useState('')
  const dialogRef = useRef<HTMLFormElement>(null)

  const showNotice = (message: string) => setNotice(message)

  const openLocationModal = () => {
    setTempLocationInput(currentLocation)
    setIsLocationModalOpen(true)
  }

  const closeLocationModal = () => setIsLocationModalOpen(false)

  const handleSaveLocation = () => {
    const nextLocation = tempLocationInput.trim()

    if (!nextLocation) {
      showNotice('Vui lòng nhập địa chỉ phục vụ.')
      return
    }

    setCurrentLocation(nextLocation)
    closeLocationModal()
    showNotice('Đã cập nhật địa chỉ phục vụ.')
  }

  const handleOverlayMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeLocationModal()
  }

  useEffect(() => {
    if (!notice) return

    const timeoutId = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  useEffect(() => {
    if (!isLocationModalOpen) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLocationModal()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button, input'),
      ).filter((element) => !element.hasAttribute('disabled'))
      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement?.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [isLocationModalOpen])

  return (
    <div className="home-screen-wrapper">
      <HomeHeader
        currentLocation={currentLocation}
        onOpenLocationModal={openLocationModal}
        onOpenNotifications={() => showNotice('Bạn chưa có thông báo mới.')}
        onOpenAccount={onOpenAccount}
        onNavigateTab={onNavigateTab}
        activeTab={activeTab}
      />

      <main className="home-main-content">
        <div className="home-container">
          <HeroBanner
            onExploreAvailableSpecialists={() =>
              showNotice('Tính năng tìm chuyên viên theo thời gian thực đang được hoàn thiện.')
            }
          />

          <div className="home-search-row">
            <div className="home-search-col">
              <SearchBar
                onSearch={(query) =>
                  showNotice(
                    query.trim()
                      ? `Đang chuẩn bị kết quả cho “${query.trim()}”.`
                      : 'Nhập tên dịch vụ hoặc chuyên viên để tìm kiếm.',
                  )
                }
                onOpenFilter={() =>
                  showNotice('Bộ lọc dịch vụ đang được hoàn thiện.')
                }
              />
            </div>
            <div className="home-location-col">
              <LocationCard
                locationName={currentLocation}
                onOpenLocationModal={openLocationModal}
              />
            </div>
          </div>

          <CategoriesGrid
            onSelectCategory={() =>
              showNotice('Danh sách dịch vụ theo danh mục đang được hoàn thiện.')
            }
          />

          <div className="home-desktop-grid">
            <div className="home-desktop-primary">
              <PopularTreatments
                onBookTreatment={(treatmentId) =>
                  onBookService(`Liệu trình ${treatmentId}`)
                }
                onViewAllTreatments={() =>
                  showNotice('Danh sách đầy đủ dịch vụ đang được hoàn thiện.')
                }
              />
            </div>

            <aside className="home-desktop-sidebar">
              <TopSpecialists
                onBookSpecialist={(specialistId) =>
                  onBookService(`Chuyên viên ${specialistId}`)
                }
                onViewAllSpecialists={() =>
                  showNotice('Danh sách chuyên viên đang được hoàn thiện.')
                }
              />
              <TrustBanner />
            </aside>
          </div>
        </div>
      </main>

      {notice && (
        <div className="home-notice" role="status" aria-live="polite">
          <span className="material-symbols-outlined" aria-hidden="true">
            info
          </span>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Đóng thông báo">
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>
      )}

      {isLocationModalOpen && (
        <div className="location-modal-overlay" onMouseDown={handleOverlayMouseDown}>
          <form
            ref={dialogRef}
            className="location-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-modal-title"
            aria-describedby="location-modal-description"
            onSubmit={(event) => {
              event.preventDefault()
              handleSaveLocation()
            }}
          >
            <div className="location-modal-header">
              <span className="material-symbols-outlined location-modal-icon" aria-hidden="true">
                location_on
              </span>
              <h2 id="location-modal-title" className="location-modal-title">
                Chọn vị trí phục vụ
              </h2>
            </div>

            <p id="location-modal-description" className="location-modal-sub">
              Nhập địa chỉ nhà hoặc nơi bạn muốn Lambe phục vụ tận nơi.
            </p>

            <input
              type="text"
              className="location-modal-input"
              placeholder="Ví dụ: Landmark 81, Bình Thạnh"
              value={tempLocationInput}
              onChange={(event) => setTempLocationInput(event.target.value)}
              autoFocus
            />

            <div className="location-modal-actions">
              <button
                type="button"
                className="location-modal-cancel"
                onClick={closeLocationModal}
              >
                Hủy
              </button>
              <button type="submit" className="location-modal-submit">
                Cập nhật địa chỉ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
