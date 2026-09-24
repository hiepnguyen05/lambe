import lambeLogo from '../../../assets/lambe-logo.svg'

interface BrandShowcaseProps {
  title: string
  subtitle: string
}

export function BrandShowcase({ title, subtitle }: BrandShowcaseProps) {
  return (
    <div className="brand-showcase">
      {/* Brand Showcase Area */}
      <div className="brand-showcase__logo-wrapper group">
        <div className="brand-showcase__logo-glow" />
        <img
          src={lambeLogo}
          alt="LAMBE Logo"
          className="brand-showcase__logo-img"
        />
      </div>

      <div className="brand-showcase__title-row">
        <span className="brand-showcase__name">LAMBE</span>
        <span className="brand-showcase__dot" />
      </div>

      <p className="brand-showcase__slogan">
        Dịch vụ làm đẹp tận nơi chuyên nghiệp
      </p>

      {/* Headings */}
      <div className="brand-showcase__headings">
        <h1 className="brand-showcase__h1">{title}</h1>
        <p className="brand-showcase__sub">{subtitle}</p>
      </div>
    </div>
  )
}
