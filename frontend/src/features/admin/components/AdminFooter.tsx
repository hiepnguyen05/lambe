interface AdminFooterProps {
  localTime: string
}

export function AdminFooter({ localTime }: AdminFooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="admin-footer">
      <p>© {currentYear} LAMBE Beauty</p>
      <p>
        Hỗ trợ: <a href="mailto:tech-support@lambe.vn">tech-support@lambe.vn</a>
      </p>
      {localTime && <time>{localTime}</time>}
    </footer>
  )
}
