interface TabPlaceholderProps {
  icon: string
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export function TabPlaceholder({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: TabPlaceholderProps) {
  return (
    <main className="tab-placeholder-main">
      <div className="tab-placeholder-card">
        <span
          className="material-symbols-outlined tab-placeholder-icon"
          aria-hidden="true"
        >
          {icon}
        </span>
        <h1 className="tab-placeholder-title">{title}</h1>
        <p className="tab-placeholder-sub">{description}</p>
        <button
          type="button"
          className="tab-placeholder-btn"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      </div>
    </main>
  )
}
