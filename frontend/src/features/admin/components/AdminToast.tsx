import type { ToastState } from '../hooks/useToast'

interface AdminToastProps {
  toast: ToastState | null
}

export function AdminToast({ toast }: AdminToastProps) {
  return (
    <div
      className={`admin-toast ${toast ? 'admin-toast--visible' : ''} ${
        toast?.tone === 'error' ? 'admin-toast--error' : ''
      }`}
      role={toast?.tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      aria-hidden={!toast}
    >
      {toast && (
        <>
          <span className="material-symbols-outlined" aria-hidden="true">
            {toast.icon}
          </span>
          <span>
            <strong>{toast.title}</strong>
            <small>{toast.message}</small>
          </span>
        </>
      )}
    </div>
  )
}
