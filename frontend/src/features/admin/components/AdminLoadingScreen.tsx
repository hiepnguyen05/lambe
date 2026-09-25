import lambeLogo from '../../../assets/lambe-logo.svg'

export function AdminLoadingScreen() {
  return (
    <main className="admin-page admin-page--loading" aria-busy="true">
      <img className="admin-loading-logo" src={lambeLogo} alt="LAMBE" />
      <span className="admin-loading-text">Đang kiểm tra phiên quản trị...</span>
    </main>
  )
}
