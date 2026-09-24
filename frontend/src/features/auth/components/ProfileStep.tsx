import type { FormEvent } from 'react'
import { AuthFeedback } from './AuthFeedback'

interface ProfileStepProps {
  fullName: string
  onFullNameChange: (val: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  isPending: boolean
  error?: string
  message?: string
}

export function ProfileStep({
  fullName,
  onFullNameChange,
  onSubmit,
  isPending,
  error,
  message,
}: ProfileStepProps) {
  return (
    <form className="profile-step-form" onSubmit={onSubmit}>
      <div className="form-field-group">
        <label htmlFor="fullname-input" className="form-label">
          Họ và tên
        </label>
        
        <div className="text-input-wrapper">
          <input
            id="fullname-input"
            type="text"
            autoComplete="name"
            maxLength={100}
            placeholder="Ví dụ: Nguyễn Văn A"
            className="text-input-field"
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            disabled={isPending}
            autoFocus
          />
        </div>

        <AuthFeedback error={error} message={message} />
      </div>

      <button
        type="submit"
        className="primary-submit-btn"
        disabled={isPending || fullName.trim().length < 2}
      >
        {isPending ? (
          <>
            <svg className="spinner-icon" fill="none" viewBox="0 0 24 24">
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
            <span>Đang hoàn tất...</span>
          </>
        ) : (
          <>
            <span>Hoàn tất đăng ký</span>
            <span className="material-symbols-outlined submit-btn-icon">
              arrow_forward
            </span>
          </>
        )}
      </button>
    </form>
  )
}
