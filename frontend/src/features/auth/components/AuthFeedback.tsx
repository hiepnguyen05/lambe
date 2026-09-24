interface AuthFeedbackProps {
  error?: string
  message?: string
}

export function AuthFeedback({ error, message }: AuthFeedbackProps) {
  if (error) {
    return (
      <div className="auth-feedback auth-feedback--error" role="alert">
        <span className="material-symbols-outlined text-[16px]">info</span>
        <span>{error}</span>
      </div>
    )
  }

  if (message) {
    return (
      <div className="auth-feedback auth-feedback--success" role="status">
        <span className="material-symbols-outlined text-[16px]">check_circle</span>
        <span>{message}</span>
      </div>
    )
  }

  return null
}
