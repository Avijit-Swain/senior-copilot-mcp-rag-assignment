import { useState } from 'react'
import { Activity, Download, Search } from 'lucide-react'
import type { TraceRecord } from '../lib/types'
import { TRACES } from '../mock/conversation'
import { Badge, Card, EmptyState, StatTile } from '../components/ui/primitives'
import { Drawer } from '../components/ui/Drawer'
import { TraceList } from '../components/investigate/TraceList'
import { datetime, ms } from '../lib/format'

/* Observability view for persisted traces. Per-answer MCP traces appear in Investigate. */

const OUTCOME_TONE = { success: 'ok', degraded: 'warn', failed: 'err' } as const

export function Traces() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<TraceRecord | null>(null)

  const rows = TRACES.filter((t) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return t.question.toLowerCase().includes(q) || t.traceId.includes(q) || t.conversationId.includes(q)
  })

  const failed = TRACES.filter((t) => t.outcome !== 'success').length
  const avgMs = TRACES.length ? Math.round(TRACES.reduce((n, t) => n + t.totalMs, 0) / TRACES.length) : 0
  const retries = TRACES.reduce((n, t) => n + t.retryCount, 0)

  return (
    <div className="page page--scroll">
      <div className="page__inner">
        <div className="page__head">
          <div>
            <h2>Request traces</h2>
            <p>
              The current backend returns the MCP call chain with each answer in the Investigation
              rail. A persisted cross-request trace history store is not implemented yet.
            </p>
          </div>
          <div className="page__head-actions">
            <button type="button" className="btn" disabled>
              <Download size={14} />
              Export JSONL
            </button>
          </div>
        </div>

        <div className="stats">
          <StatTile label="Requests" value={TRACES.length} hint="persisted history" />
          <StatTile label="Non-success" value={failed} hint="degraded or failed" />
          <StatTile label="Avg duration" value={TRACES.length ? ms(avgMs) : '—'} hint="end to end" />
          <StatTile label="Tool retries" value={retries} hint="across all requests" />
        </div>

        <label className="searchbox">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by question, trace ID or conversation ID…"
            aria-label="Filter traces"
          />
        </label>

        <Card flush>
          {rows.length === 0 ? (
            <EmptyState
              icon={<Activity size={20} />}
              title={TRACES.length === 0 ? 'No persisted traces yet' : 'No traces match'}
              body={
                TRACES.length === 0
                  ? 'Run an investigation to see the live MCP trace in the Evidence rail. Persisted trace history is a pending backend feature.'
                  : 'Try a different filter.'
              }
            />
          ) : (
            <div className="table__scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Trace</th>
                    <th>Question</th>
                    <th>Outcome</th>
                    <th>Tools</th>
                    <th>Retries</th>
                    <th>Docs</th>
                    <th>Top score</th>
                    <th>LLM</th>
                    <th>Total</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.traceId} className="is-clickable" onClick={() => setSelected(t)}>
                      <td>
                        <div className="mono">{t.traceId}</div>
                        <div className="subtle mono" style={{ fontSize: 'var(--text-2xs)' }}>
                          {t.conversationId}
                        </div>
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        <div className="truncate">{t.question}</div>
                      </td>
                      <td>
                        <Badge tone={OUTCOME_TONE[t.outcome]}>{t.outcome}</Badge>
                      </td>
                      <td className="num">{t.toolCount}</td>
                      <td className="num">{t.retryCount || '—'}</td>
                      <td className="num">{t.retrievedDocs}</td>
                      <td className="num">{t.topScore ? t.topScore.toFixed(2) : '—'}</td>
                      <td className="num">{t.llmMs ? ms(t.llmMs) : '—'}</td>
                      <td className="num">{ms(t.totalMs)}</td>
                      <td className="num subtle">{datetime(t.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Drawer
        open={selected !== null}
        title={selected?.traceId ?? ''}
        subtitle={selected?.question}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <div className="stats">
              <StatTile label="Total" value={ms(selected.totalMs)} />
              <StatTile label="LLM" value={selected.llmMs ? ms(selected.llmMs) : '—'} />
              <StatTile label="Retrieval" value={selected.retrievalMs ? ms(selected.retrievalMs) : '—'} />
              <StatTile label="Retries" value={selected.retryCount} />
            </div>

            <dl className="kv">
              <dt>request_id</dt>
              <dd className="mono">{selected.requestId}</dd>
              <dt>conversation_id</dt>
              <dd className="mono">{selected.conversationId}</dd>
              <dt>trace_id</dt>
              <dd className="mono">{selected.traceId}</dd>
              <dt>outcome</dt>
              <dd>
                <Badge tone={OUTCOME_TONE[selected.outcome]}>{selected.outcome}</Badge>
              </dd>
              <dt>documents</dt>
              <dd>
                {selected.retrievedDocs} retrieved · top score{' '}
                {selected.topScore ? selected.topScore.toFixed(2) : 'n/a'}
              </dd>
            </dl>

            <div>
              <div className="iolabel">MCP call chain</div>
              <TraceList calls={selected.calls} />
            </div>
          </>
        )}
      </Drawer>
    </div>
  )
}
