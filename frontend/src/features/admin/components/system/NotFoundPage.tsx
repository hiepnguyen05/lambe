import { Link } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { ROUTES } from '../../../../app/routes'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <FileQuestion className="mb-4 h-12 w-12 text-slate-500" />
      <h1 className="text-2xl font-bold text-slate-900">Không tìm thấy trang</h1>
      <p className="mt-2 text-sm text-slate-500">Đường dẫn không tồn tại hoặc chức năng chưa được cung cấp.</p>
      <Link className="mt-6 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white" to={ROUTES.ADMIN.DASHBOARD}>
        Về trang tổng quan
      </Link>
    </div>
  )
}
