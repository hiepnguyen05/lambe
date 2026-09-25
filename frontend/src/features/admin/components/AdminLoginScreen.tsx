import { useAdminAuth } from '../hooks/useAdminAuth'
import { useClock } from '../hooks/useClock'
import { useToast } from '../hooks/useToast'
import { AdminBrandHeader } from './AdminBrandHeader'
import { AdminFooter } from './AdminFooter'
import { AdminLoadingScreen } from './AdminLoadingScreen'
import { AdminLoginForm } from './AdminLoginForm'
import { AdminToast } from './AdminToast'
import { AdminDashboardLayout } from './layout/AdminDashboardLayout'
import './AdminLoginScreen.css'



function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
}

export function AdminLoginScreen() {
  const { account, isSubmitting, isRestoring, login, logout } = useAdminAuth()
  const localTime = useClock()
  const { toast, showToast } = useToast()

  const handleLoginSubmit = async (username: string, password: string) => {
    if (!username || !password) {
      showToast({
        title: 'Thiếu thông tin',
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu.',
        icon: 'warning',
        tone: 'error',
      })
      return
    }

    try {
      const loggedInAccount = await login(username, password)
      showToast({
        title: 'Xác thực thành công',
        message: `Chào mừng ${loggedInAccount.fullName} quay trở lại.`,
        icon: 'verified_user',
        tone: 'default',
      })
    } catch (error) {
      showToast({
        title: 'Đăng nhập thất bại',
        message: getErrorMessage(error),
        icon: 'error',
        tone: 'error',
      })
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      showToast({
        title: 'Đã đăng xuất',
        message: 'Phiên quản trị đã được đóng an toàn.',
        icon: 'logout',
        tone: 'default',
      })
    } catch (error) {
      showToast({
        title: 'Đã đóng phiên trên thiết bị',
        message: getErrorMessage(error),
        icon: 'warning',
        tone: 'error',
      })
    }
  }

  const handleRecoveryHelp = () => {
    showToast({
      title: 'Khôi phục quyền quản trị',
      message: 'Liên hệ sec-ops@lambe.vn kèm mã nhân sự để được hỗ trợ.',
      icon: 'support_agent',
      tone: 'default',
    })
  }

  if (isRestoring) {
    return <AdminLoadingScreen />
  }

  if (account) {
    return (
      <>
        <AdminDashboardLayout
          account={account}
          localTime={localTime}
          onLogout={() => void handleLogout()}
          onShowToast={(title, message, icon, isError) =>
            showToast({
              title,
              message,
              icon: icon || 'info',
              tone: isError ? 'error' : 'default',
            })
          }
        />
        <AdminToast toast={toast} />
      </>
    )
  }


  return (
    <main className="admin-page">
      <section className="admin-shell" aria-labelledby="admin-page-title">
        <div className="admin-panel">
          <div className="admin-panel__accent" />

          <AdminBrandHeader
            title="Đăng nhập quản trị viên"
            subtitle="Truy cập dành riêng cho tài khoản nội bộ"
          />

          <AdminLoginForm
            isSubmitting={isSubmitting}
            onSubmit={handleLoginSubmit}
            onRecoveryHelp={handleRecoveryHelp}
          />
        </div>

        <AdminFooter localTime={localTime} />
      </section>

      <AdminToast toast={toast} />
    </main>
  )

}
