import { useState, type FormEvent } from 'react'

interface AdminLoginFormProps {
  isSubmitting: boolean
  onSubmit: (username: string, password: string) => Promise<void>
  onRecoveryHelp: () => void
}

export function AdminLoginForm({
  isSubmitting,
  onSubmit,
  onRecoveryHelp,
}: AdminLoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSubmit(username.trim(), password)
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-field">
        <label htmlFor="admin-username">Tên đăng nhập</label>
        <span className="admin-field__control">
          <span className="material-symbols-outlined" aria-hidden="true">
            account_circle
          </span>
          <input
            id="admin-username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={isSubmitting}
            required
            autoFocus
          />
        </span>
      </div>

      <div className="admin-field">
        <label htmlFor="admin-password">Mật khẩu</label>
        <span className="admin-field__control">
          <span className="material-symbols-outlined" aria-hidden="true">
            lock
          </span>
          <input
            id="admin-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
            required
          />
          <button
            type="button"
            className="admin-field__visibility"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </span>
      </div>

      <button
        type="button"
        className="admin-recovery-button"
        onClick={onRecoveryHelp}
      >
        Quên mật khẩu hoặc cần cấp lại quyền?
      </button>

      <button
        type="submit"
        className="admin-button"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <span className="admin-spinner" aria-hidden="true" />
        ) : (
          <span className="material-symbols-outlined" aria-hidden="true">
            login
          </span>
        )}
        {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập'}
      </button>
    </form>
  )
}
