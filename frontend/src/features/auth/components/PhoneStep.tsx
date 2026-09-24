import { useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import { AuthFeedback } from './AuthFeedback'

interface PhoneStepProps {
  phone: string
  onPhoneChange: (val: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  isPending: boolean
  error?: string
  message?: string
}

interface Country {
  code: string
  dialCode: string
  flag: string
  name: string
}

const COUNTRIES: Country[] = [
  { code: 'VN', dialCode: '+84', flag: '🇻🇳', name: 'Việt Nam' },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'Hoa Kỳ' },
  { code: 'JP', dialCode: '+81', flag: '🇯🇵', name: 'Nhật Bản' },
  { code: 'KR', dialCode: '+82', flag: '🇰🇷', name: 'Hàn Quốc' },
  { code: 'SG', dialCode: '+65', flag: '🇸🇬', name: 'Singapore' },
]

function formatPhoneDisplay(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 10)
  if (digits.length > 6) {
    return digits.replace(/(\d{4})(\d{3})(\d+)/, '$1 $2 $3')
  }
  if (digits.length > 4) {
    return digits.replace(/(\d{4})(\d+)/, '$1 $2')
  }
  return digits
}

export function PhoneStep({
  phone,
  onPhoneChange,
  onSubmit,
  isPending,
  error,
  message,
}: PhoneStepProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0])
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const formattedValue = formatPhoneDisplay(phone)

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '')
    onPhoneChange(rawDigits)
  }

  const handleClear = () => {
    onPhoneChange('')
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country)
    setIsCountryMenuOpen(false)
  }

  return (
    <form className="phone-step-form" onSubmit={onSubmit}>
      {/* Phone Input Section */}
      <div className="form-field-group">
        <label htmlFor="phone-input" className="form-label">
          Số điện thoại
        </label>
        
        <div className="phone-input-container">
          {/* Country Selector Trigger */}
          <div className="country-selector-wrapper">
            <button
              id="country-selector-btn"
              type="button"
              className="country-selector-btn"
              aria-label="Chọn quốc gia"
              onClick={() => setIsCountryMenuOpen((prev) => !prev)}
            >
              <span className="country-flag">{selectedCountry.flag}</span>
              <span className="country-dial">{selectedCountry.dialCode}</span>
              <span className="material-symbols-outlined country-arrow">
                keyboard_arrow_down
              </span>
            </button>

            {/* Country Dropdown Popup */}
            {isCountryMenuOpen && (
              <div className="country-dropdown">
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className={`country-option ${c.code === selectedCountry.code ? 'country-option--active' : ''}`}
                    onClick={() => handleSelectCountry(c)}
                  >
                    <span className="country-flag">{c.flag}</span>
                    <span className="country-name">{c.name}</span>
                    <span className="country-dial">{c.dialCode}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider bar */}
          <div className="phone-input-divider" />

          {/* Phone Input Field */}
          <input
            ref={inputRef}
            id="phone-input"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="tel"
            placeholder="0912 345 678"
            className="phone-input-field"
            value={formattedValue}
            onChange={handleInputChange}
            disabled={isPending}
            autoFocus
          />

          {/* Input Clear Button */}
          {phone.length > 0 && (
            <button
              id="clear-phone-btn"
              type="button"
              className="clear-phone-btn"
              aria-label="Xóa nội dung"
              onClick={handleClear}
            >
              <span className="material-symbols-outlined">cancel</span>
            </button>
          )}
        </div>

        {/* Feedback Alert */}
        <AuthFeedback error={error} message={message} />
      </div>

      {/* Primary Action Button */}
      <button
        id="submit-btn"
        type="submit"
        className="primary-submit-btn"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <svg
              className="spinner-icon"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Đang gửi mã...</span>
          </>
        ) : (
          <>
            <span>Tiếp tục</span>
            <span className="material-symbols-outlined submit-btn-icon">
              arrow_forward
            </span>
          </>
        )}
      </button>

      {/* Separator */}
      <div className="social-separator">
        <div className="social-separator-line" />
        <span className="social-separator-text">Hoặc tiếp tục với</span>
      </div>

      {/* Social Authentication Methods */}
      <div className="social-buttons-grid">
        {/* Google Auth Button */}
        <button
          type="button"
          className="social-auth-btn"
          onClick={() => alert('Tính năng đăng nhập Google sắp ra mắt!')}
        >
          <svg className="social-icon" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          <span>Tiếp tục với Google</span>
        </button>

        {/* Apple Auth Button */}
        <button
          type="button"
          className="social-auth-btn"
          onClick={() => alert('Tính năng đăng nhập Apple sắp ra mắt!')}
        >
          <svg className="social-icon text-on-surface" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.98.6-2.62 1.35-.57.65-1.06 1.71-.93 2.72.99.08 2.01-.47 2.62-1.22z" />
          </svg>
          <span>Tiếp tục với Apple</span>
        </button>
      </div>

      <p className="auth-legal-text">
        Bằng việc tiếp tục, bạn đồng ý với{' '}
        <a href="#terms" className="auth-legal-link">
          Điều khoản sử dụng
        </a>{' '}
        và{' '}
        <a href="#privacy" className="auth-legal-link">
          Chính sách bảo mật
        </a>{' '}
        của Lambe.
      </p>
    </form>
  )
}
