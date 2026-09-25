import type { AdminAccount } from '../types/admin-auth.types'

interface AdminSessionInfoProps {
  account: AdminAccount
  isSubmitting: boolean
  onLogout: () => void
}

export function AdminSessionInfo({
  account,
  isSubmitting,
  onLogout,
}: AdminSessionInfoProps) {
  return (
    <div className="admin-session">
      <div className="admin-session__status">
        <span className="material-symbols-outlined" aria-hidden="true">
          verified_user
        </span>
        Đã xác thực
      </div>

      <dl className="admin-account-list">
        <div>
          <dt>Họ và tên</dt>
          <dd>{account.fullName}</dd>
        </div>
        <div>
          <dt>Tên đăng nhập</dt>
          <dd className="admin-account-list__mono">{account.username}</dd>
        </div>
        <div>
          <dt>Vai trò</dt>
          <dd className="admin-role-list">
            {account.roles.map((role) => (
              <span key={role}>{role}</span>
            ))}
          </dd>
        </div>
        {account.email && (
          <div>
            <dt>Email</dt>
            <dd>{account.email}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        className="admin-button admin-button--danger"
        onClick={onLogout}
        disabled={isSubmitting}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          logout
        </span>
        {isSubmitting ? 'Đang đăng xuất...' : 'Đăng xuất'}
      </button>
    </div>
  )
}
