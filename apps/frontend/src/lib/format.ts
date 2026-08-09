import type { DocKind } from './types'

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  'operating-procedure': 'Operating procedure',
  'maintenance-manual': 'Maintenance manual',
  'troubleshooting-guide': 'Troubleshooting guide',
  'safety-instruction': 'Safety instruction',
  'alarm-philosophy': 'Alarm philosophy',
  'knowledge-article': 'Knowledge article',
}

export function ms(value: number) {
  if (value < 1000) return `${value}ms`
  const s = value / 1000
  return `${Number.isInteger(s) ? s : s.toFixed(2)}s`
}

export function pct(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function datetime(iso: string) {
  return new Date(iso).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
