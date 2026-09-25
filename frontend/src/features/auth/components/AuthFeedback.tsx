interface AuthFeedbackProps {
  error?: string
  message?: string
}

export function AuthFeedback({ error, message }: AuthFeedbackProps) {
  if (error) {
    return (
      <div className="auth-feedback auth-feedback--error" role="alert">
        <span className="material-symbols-outlined auth-feedback__icon">info</span>
        <span>{error}</span>
      </div>
    )
  }

  if (message) {
    return (
      <div className="auth-feedback auth-feedback--success" role="status">
        <span className="material-symbols-outlined auth-feedback__icon">check_circle</span>
        <span>{message}</span>
      </div>
    )
  }

  return null
}
