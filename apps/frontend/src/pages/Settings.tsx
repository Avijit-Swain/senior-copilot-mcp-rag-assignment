import { useState } from 'react'
import { Eye, EyeOff, HeartPulse, Palette, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { ENV_SETTINGS, HEALTH_CHECKS } from '../mock/conversation'
import { Badge, Card, Segmented, StatusDot } from '../components/ui/primitives'
import { useTheme, type Theme } from '../lib/theme'
import { ms } from '../lib/format'

/* --------------------------------------------------------------------------
   Runtime configuration and service health.
   Values are read-only: configuration is supplied through the environment.
   -------------------------------------------------------------------------- */

export function Settings() {
  const { theme, setTheme } = useTheme()
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  return (
    <div className="page page--scroll">
      <div className="page__inner">
        <div className="page__head">
          <div>
            <h2>Configuration</h2>
            <p>
              All runtime configuration comes from environment variables. Secrets are never sent to the
              browser — the backend returns a masked placeholder only.
            </p>
          </div>
          <div className="page__head-actions">
            <button type="button" className="btn" disabled>
              <RefreshCw size={14} />
              Re-check health
            </button>
          </div>
        </div>

        <Card title="Service health" icon={<HeartPulse size={13} />} flush>
          {HEALTH_CHECKS.map((h) => (
            <div className="health" key={h.id}>
              <StatusDot status={h.status} pulse={h.status !== 'ok'} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="health__name">{h.name}</div>
                <div className="health__url truncate">{h.url}</div>
              </div>
              <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
                {h.detail}
              </span>
              <span className="num spacer">{h.latencyMs !== null ? ms(h.latencyMs) : '—'}</span>
              <Badge tone={h.status === 'ok' ? 'ok' : h.status === 'degraded' ? 'warn' : h.status === 'down' ? 'err' : 'neutral'}>
                {h.status}
              </Badge>
            </div>
          ))}
        </Card>

        <Card title="Environment" icon={<SlidersHorizontal size={13} />} flush>
          <div className="table__scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Value</th>
                  <th>Source</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {ENV_SETTINGS.map((e) => (
                  <tr key={e.key}>
                    <td className="envvar">{e.key}</td>
                    <td>
                      {e.secret ? (
                        <span className="secret">
                          {revealed[e.key] ? e.value : '••••••••••••'}
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setRevealed((r) => ({ ...r, [e.key]: !r[e.key] }))}
                            aria-label={revealed[e.key] ? `Hide ${e.key}` : `Reveal ${e.key}`}
                          >
                            {revealed[e.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </span>
                      ) : (
                        <span className="envvar muted">{e.value}</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={e.source === 'env' ? 'ok' : 'neutral'}>{e.source}</Badge>
                    </td>
                    <td className="muted" style={{ fontSize: 'var(--text-xs)', maxWidth: 320 }}>
                      {e.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Security posture" icon={<ShieldCheck size={13} />}>
          <div className="col" style={{ gap: 'var(--sp-3)' }}>
            <PostureRow
              label="Alarm MCP write operations"
              state="enforced"
              detail="The candidate-developed MCP server exposes read/analysis tools only. No ticket creation or source-system mutation tool exists in this repo."
            />
            <PostureRow
              label="Retrieved-document trust boundary"
              state="enforced"
              detail="Retrieved documents are passed as delimited data, never instructions. The RAG answerer is required to ignore instructions embedded in corpus text."
            />
            <PostureRow
              label="Secret handling"
              state="enforced"
              detail="OPENAI_API_KEY and ALARM_API_TOKEN stay server-side. The browser only receives masked configuration labels."
            />
            <PostureRow
              label="Tool input validation"
              state="enforced"
              detail="MCP tool inputs are typed with Pydantic schemas before the upstream Alarm API request is constructed."
            />
          </div>
        </Card>

        <Card title="Appearance" icon={<Palette size={13} />}>
          <div className="row">
            <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              Interface theme
            </span>
            <span className="spacer">
              <Segmented<Theme>
                value={theme}
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                ]}
                onChange={setTheme}
              />
            </span>
          </div>
        </Card>
      </div>
    </div>
  )
}

function PostureRow({ label, state, detail }: { label: string; state: string; detail: string }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
      <Badge tone="ok">{state}</Badge>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{label}</div>
        <p className="muted" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6, marginTop: 2 }}>
          {detail}
        </p>
      </div>
    </div>
  )
}
