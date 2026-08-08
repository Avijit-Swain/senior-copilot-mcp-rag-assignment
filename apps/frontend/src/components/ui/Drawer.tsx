import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Right-hand slide-over used for raw request/response and document detail. */
export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="drawer__scrim" onClick={onClose} aria-hidden />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}>
        <header className="drawer__head">
          <div style={{ minWidth: 0 }}>
            <div className="drawer__title">{title}</div>
            {subtitle && <div className="subtle" style={{ fontSize: 'var(--text-xs)' }}>{subtitle}</div>}
          </div>
          <button type="button" className="btn btn--ghost btn--icon spacer" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
      </aside>
    </>
  )
}
