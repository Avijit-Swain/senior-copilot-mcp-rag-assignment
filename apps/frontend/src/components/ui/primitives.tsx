import { useState, type ReactNode } from 'react'
import { AlertTriangle, ChevronRight, Inbox, TriangleAlert } from 'lucide-react'
import type { ServiceStatus, Severity, ToolStatus } from '../../lib/types'

/* --------------------------------------------------------------------------
   Small presentational primitives shared across every page.
   -------------------------------------------------------------------------- */

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Severity | 'ok' | 'warn' | 'err' | 'neutral'
  children: ReactNode
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

const STATUS_TONE: Record<ServiceStatus, 'ok' | 'warn' | 'err' | 'idle'> = {
  ok: 'ok',
  degraded: 'warn',
  down: 'err',
  unknown: 'idle',
}

export function StatusDot({ status, pulse }: { status: ServiceStatus; pulse?: boolean }) {
  return <span className={`dot dot--${STATUS_TONE[status]}${pulse ? ' dot--pulse' : ''}`} aria-hidden />
}

export function ToolStatusBadge({ status }: { status: ToolStatus }) {
  const map: Record<ToolStatus, { tone: 'ok' | 'warn' | 'err' | 'neutral'; label: string }> = {
    ok: { tone: 'ok', label: 'ok' },
    error: { tone: 'err', label: 'error' },
    running: { tone: 'neutral', label: 'running' },
    skipped: { tone: 'neutral', label: 'skipped' },
    retrying: { tone: 'warn', label: 'retrying' },
  }
  const { tone, label } = map[status]
  return <Badge tone={tone}>{label}</Badge>
}

export function Card({
  title,
  icon,
  actions,
  children,
  flush,
}: {
  title?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
}) {
  return (
    <section className="card">
      {title && (
        <header className="card__head">
          <h3 className="card__title">
            {icon}
            {title}
          </h3>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      <div className={`card__body${flush ? ' card__body--flush' : ''}`}>{children}</div>
    </section>
  )
}

/** Card whose header toggles the body open and closed. */
export function CollapsibleCard({
  title,
  icon,
  meta,
  defaultOpen = false,
  children,
}: {
  title: ReactNode
  icon?: ReactNode
  meta?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="card">
      <button
        type="button"
        className={`card__head card__toggle${open ? '' : ' card__head--collapsed'}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ChevronRight size={14} className={`chev${open ? ' is-open' : ''}`} />
        <span className="card__title">
          {icon}
          {title}
        </span>
        {meta && <span className="card__actions">{meta}</span>}
      </button>
      {open && <div className="card__body">{children}</div>}
    </section>
  )
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon ?? <Inbox size={20} />}</div>
      <div className="empty__title">{title}</div>
      {body && <p className="empty__body">{body}</p>}
      {action}
    </div>
  )
}

export function ErrorBox({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="errorbox" role="alert">
      <TriangleAlert size={16} className="errorbox__icon" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="errorbox__title">{title}</div>
        {body && <div className="errorbox__body">{body}</div>}
      </div>
      {action}
    </div>
  )
}

export function WarnBox({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="warnbox" role="status">
      <AlertTriangle size={16} className="warnbox__icon" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="errorbox__title">{title}</div>
        {body && <div className="errorbox__body">{body}</div>}
      </div>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`seg__btn${value === o.value ? ' is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Skeleton({ w = '100%', h = 12 }: { w?: string | number; h?: number }) {
  return <div className="skel" style={{ width: w, height: h }} />
}

export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skel-stack">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} w={i === lines - 1 ? '62%' : '100%'} />
      ))}
    </div>
  )
}

export function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100)
  return (
    <span className="meter" title={`${pct}%`}>
      <span className="meter__track">
        <span className="meter__fill" style={{ width: `${pct}%` }} />
      </span>
      {label ?? `${pct}%`}
    </span>
  )
}
