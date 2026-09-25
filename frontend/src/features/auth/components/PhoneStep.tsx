import { useRef, type ChangeEvent, type FormEvent } from 'react'
import {
  formatNationalPhone,
  normalizeNationalPhoneInput,
} from '../utils/phone'
import { AuthFeedback } from './AuthFeedback'

interface PhoneStepProps {
  phone: string
  onPhoneChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isPending: boolean
  error?: string
  message?: string
}

export function PhoneStep({
  phone,
  onPhoneChange,
  onSubmit,
  isPending,
  error,
  message,
}: PhoneStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onPhoneChange(normalizeNationalPhoneInput(event.target.value))
  }

  const handleClear = () => {
    onPhoneChange('')
    inputRef.current?.focus()
  }

  return (
    <form className="phone-step-form" onSubmit={onSubmit}>
      <div className="form-field-group">
        <label htmlFor="phone-input" className="form-label">
          Số điện thoại Việt Nam
        </label>

        <div className="phone-input-container">
          <div className="country-code" aria-label="Mã quốc gia Việt Nam cộng tám tư">
            <span className="country-code__label">VN</span>
            <span className="country-dial">+84</span>
          </div>

          <div className="phone-input-divider" />

          <input
            ref={inputRef}
            id="phone-input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="912 345 678"
            className="phone-input-field"
            value={formatNationalPhone(phone)}
            onChange={handleInputChange}
            disabled={isPending}
            maxLength={11}
            autoFocus
          />

          {phone.length > 0 && (
            <button
              type="button"
              className="clear-phone-btn"
              aria-label="Xóa số điện thoại"
              onClick={handleClear}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                cancel
              </span>
            </button>
          )}
        </div>

        <AuthFeedback error={error} message={message} />
      </div>

      <button
        type="submit"
        className="primary-submit-btn"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <svg className="spinner-icon" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle
                className="spinner-track"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="spinner-indicator"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Đang gửi mã...</span>
          </>
        ) : (
          <>
            <span>Tiếp tục</span>
            <span className="material-symbols-outlined submit-btn-icon" aria-hidden="true">
              arrow_forward
            </span>
          </>
        )}
      </button>

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
