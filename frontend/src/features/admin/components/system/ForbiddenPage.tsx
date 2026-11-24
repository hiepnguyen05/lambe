import { Link } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { ROUTES } from '../../../../app/routes'

export function ForbiddenPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <ShieldX className="mb-4 h-12 w-12 text-rose-600" />
      <h1 className="text-2xl font-bold text-slate-900">Không có quyền truy cập</h1>
      <p className="mt-2 text-sm text-slate-500">
        Tài khoản của bạn không được cấp quyền sử dụng chức năng này.
      </p>
      <Link className="mt-6 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white" to={ROUTES.ADMIN.DASHBOARD}>
        Về trang tổng quan
      </Link>
    </div>
  )
}
