import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { apiRequest } from '../../../../lib/api-client'
import { ROUTES } from '../../../../app/routes'

export function AdminActivateScreen() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!token) return setError('Liên kết kích hoạt không hợp lệ.')
    if (password !== confirmation) return setError('Mật khẩu xác nhận không khớp.')
    setSubmitting(true)
    try {
      await apiRequest('/admin/auth/activate', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setMessage('Tài khoản đã được kích hoạt. Bạn có thể đăng nhập.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kích hoạt tài khoản.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <h1 className="text-xl font-bold text-slate-900">Kích hoạt tài khoản quản trị</h1>
        <p className="mt-1 text-sm text-slate-500">Thiết lập mật khẩu để hoàn tất kích hoạt.</p>
        {message ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>
            <Link className="block rounded-xl bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white" to={ROUTES.ADMIN.LOGIN}>Đăng nhập</Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
            <input type="password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu mới" className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            <input type="password" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Nhập lại mật khẩu" className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            <button disabled={submitting || !token} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Kích hoạt
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
