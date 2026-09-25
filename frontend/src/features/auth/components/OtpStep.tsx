import type { FormEvent } from 'react'
import { AuthFeedback } from './AuthFeedback'

interface OtpStepProps {
  phone: string
  otpCode: string
  onOtpCodeChange: (val: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onResend: () => void
  onBack: () => void
  isPending: boolean
  cooldown: number
  error?: string
  message?: string
}

export function OtpStep({
  phone,
  otpCode,
  onOtpCodeChange,
  onSubmit,
  onResend,
  onBack,
  isPending,
  cooldown,
  error,
  message,
}: OtpStepProps) {
  return (
    <form className="otp-step-form" onSubmit={onSubmit}>
      <button type="button" className="otp-back-btn" onClick={onBack}>
        <span className="material-symbols-outlined">arrow_back</span>
        <span>Đổi số điện thoại ({phone})</span>
      </button>

      <div className="form-field-group">
        <label htmlFor="otp-input" className="form-label">
          Mã xác thực OTP
        </label>
        
        <input
          id="otp-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="otp-input-field"
          value={otpCode}
          onChange={(e) =>
            onOtpCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))
          }
          disabled={isPending}
          autoFocus
        />

        <AuthFeedback error={error} message={message} />
      </div>

      <button
        type="submit"
        className="primary-submit-btn"
        disabled={isPending || otpCode.length < 6}
      >
        {isPending ? (
          <>
            <svg className="spinner-icon" fill="none" viewBox="0 0 24 24">
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
            <span>Đang xác thực...</span>
          </>
        ) : (
          <>
            <span>Xác thực mã OTP</span>
            <span className="material-symbols-outlined submit-btn-icon">
              arrow_forward
            </span>
          </>
        )}
      </button>

      <button
        type="button"
        className="resend-otp-btn"
        disabled={cooldown > 0 || isPending}
        onClick={onResend}
      >
        {cooldown > 0 ? (
          <span>Gửi lại mã sau {cooldown}s</span>
        ) : (
          <span>Chưa nhận được mã? Gửi lại OTP</span>
        )}
      </button>
    </form>
  )
}
