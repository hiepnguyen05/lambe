import lambeLogo from '../../../assets/lambe-logo.svg'

interface AdminBrandHeaderProps {
  title: string
  subtitle: string
}

export function AdminBrandHeader({ title, subtitle }: AdminBrandHeaderProps) {
  return (
    <header className="admin-brand">
      <div className="admin-brand__logo-box">
        <img src={lambeLogo} alt="" className="admin-brand__logo" />
      </div>
      <h1 id="admin-page-title">{title}</h1>
      <p>{subtitle}</p>
    </header>
  )
}
