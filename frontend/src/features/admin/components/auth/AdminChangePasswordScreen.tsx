import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { KeyRound, Loader2 } from 'lucide-react'
import { apiRequest } from '../../../../lib/api-client'
import { ROUTES } from '../../../../app/routes'
import { useAdminAuth } from '../../hooks/useAdminAuth'

export function AdminChangePasswordScreen() {
  const { account, logout } = useAdminAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!account) return <Navigate to={ROUTES.ADMIN.LOGIN} replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (newPassword !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest('/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      await logout()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể đổi mật khẩu.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <KeyRound className="h-7 w-7 text-teal-700" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Đổi mật khẩu</h1>
          <p className="text-sm text-slate-500">
            {account.mustChangePassword ? 'Bạn phải đổi mật khẩu trước khi tiếp tục.' : 'Đổi mật khẩu tài khoản quản trị.'}
          </p>
        </div>
      </div>
      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <form className="space-y-4" onSubmit={submit}>
        <PasswordField label="Mật khẩu hiện tại" value={currentPassword} onChange={setCurrentPassword} />
        <PasswordField label="Mật khẩu mới" value={newPassword} onChange={setNewPassword} minLength={12} />
        <PasswordField label="Nhập lại mật khẩu mới" value={confirmation} onChange={setConfirmation} minLength={12} />
        <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Đổi mật khẩu
        </button>
      </form>
    </div>
  )
}

function PasswordField({ label, value, onChange, minLength = 1 }: { label: string; value: string; onChange: (value: string) => void; minLength?: number }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        type="password"
        required
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 font-normal outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
      />
    </label>
  )
}
