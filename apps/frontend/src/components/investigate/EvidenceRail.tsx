import { useState } from 'react'
import {
  BookText,
  ChevronRight,
  FileWarning,
  GitCompareArrows,
  Lightbulb,
  ListChecks,
  Quote,
  Route,
  ShieldCheck,
  Sigma,
} from 'lucide-react'
import type { AnswerBlock, Citation, Severity } from '../../lib/types'
import { Badge, EmptyState, Meter, StatTile, WarnBox } from '../ui/primitives'
import { TraceList } from './TraceList'
import { DOC_KIND_LABEL, ms, pct } from '../../lib/format'

type RailTab = 'evidence' | 'trace'

type CompletedTurn = {
  id: string
  question: string
  answer: AnswerBlock
  createdAt: string
}

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low']
const SEV_VAR: Record<Severity, string> = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
}

function citationDocumentCount(citations: Citation[]): number {
  return new Set(citations.map((c) => c.documentId)).size
}

function groupedCitations(citations: Citation[]) {
  const groups = new Map<string, Citation[]>()
  citations.forEach((citation) => {
    const key = citation.documentId
    groups.set(key, [...(groups.get(key) ?? []), citation])
  })
  return Array.from(groups.values())
}

export function EvidenceRail({
  answer,
  history,
  loading,
  onCitationClick,
}: {
  answer: AnswerBlock | null
  history: CompletedTurn[]
  loading: boolean
  onCitationClick: (c: Citation) => void
}) {
  const [tab, setTab] = useState<RailTab>('evidence')

  return (
    <aside className="invest__rail">
      <div className="rail__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'evidence'}
          className={`rail__tab${tab === 'evidence' ? ' is-active' : ''}`}
          onClick={() => setTab('evidence')}
        >
          <Sigma size={14} />
          Evidence
          {!!answer?.citations.length && <span className="rail__tab-count">{citationDocumentCount(answer.citations)}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'trace'}
          className={`rail__tab${tab === 'trace' ? ' is-active' : ''}`}
          onClick={() => setTab('trace')}
        >
          <Route size={14} />
          MCP Trace
          {!!answer?.toolCalls.length && <span className="rail__tab-count">{answer.toolCalls.length}</span>}
        </button>
      </div>

      <div className="rail__body">
        {loading && <RailSkeleton />}

        {!loading && !answer && history.length === 0 && (
          <EmptyState
            icon={<Sigma size={20} />}
            title="No investigation yet"
            body="Ask a question and the alarm summary, likely causes, recommended actions, citations and the full MCP tool trace will appear here."
          />
        )}

        {!loading && !answer && history.length > 0 && tab === 'evidence' && (
          <PreviousEvidenceTurns history={history} onCitationClick={onCitationClick} />
        )}

        {!loading && !answer && history.length > 0 && tab === 'trace' && (
          <PreviousTraceTurns history={history} />
        )}

        {!loading && answer && tab === 'evidence' && (
          <EvidencePanel answer={answer} history={history} onCitationClick={onCitationClick} />
        )}

        {!loading && answer && tab === 'trace' && <TracePanel answer={answer} history={history} />}
      </div>
    </aside>
  )
}

/* --- Evidence tab ----------------------------------------------------- */

function EvidencePanel({
  answer,
  history,
  onCitationClick,
}: {
  answer: AnswerBlock
  history: CompletedTurn[]
  onCitationClick: (c: Citation) => void
}) {
  return (
    <>
      {answer.degraded && (
        <WarnBox title="Degraded result" body={answer.degraded.reason} />
      )}
      {answer.lowConfidence && (
        <WarnBox
          title="Low retrieval confidence"
          body={`${answer.lowConfidence.reason} Top score ${answer.lowConfidence.topScore.toFixed(2)} against a floor of ${answer.lowConfidence.floor.toFixed(2)}.`}
        />
      )}

      {answer.summary && <AlarmSummaryCard summary={answer.summary} />}

      <Section title="Likely causes" icon={<Lightbulb size={13} />} count={answer.causes.length}>
        {answer.causes.length === 0 ? (
          <p className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
            No ranked causes were produced for this request.
          </p>
        ) : (
          answer.causes.map((c, i) => (
            <div className="cause" key={c.id}>
              <span className="cause__rank">{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div className="cause__title">{c.title}</div>
                <p className="cause__desc">{c.description}</p>
                <div className="cause__meta">
                  <Meter value={c.confidence} />
                  {c.citationRefs.map((r) => (
                    <span key={r} className="cite">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </Section>

      <Section
        title="Recommended actions"
        icon={<ListChecks size={13} />}
        count={answer.recommendations.length}
      >
        {answer.recommendations.map((r) => (
          <div className="rec" key={r.id}>
            <span className="rec__step">{r.step}</span>
            <div style={{ minWidth: 0 }}>
              <div className="rec__text">{r.text}</div>
              <div className="rec__source">
                <AgreementTag agreement={r.agreement} />
                {r.citationRefs.map((ref) => (
                  <span key={ref} className="cite">
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Evidence passages" icon={<Quote size={13} />} count={citationDocumentCount(answer.citations)}>
        {answer.citations.length === 0 ? (
          <p className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
            No document passage met the retrieval confidence floor, so nothing is cited.
          </p>
        ) : (
          groupedCitations(answer.citations).map((citations) => {
            const first = citations[0]
            return (
            <button type="button" className="citation" key={first.documentId} onClick={() => onCitationClick(first)}>
              <span className="citation__marker">{citations.map((c) => c.ref).join(',')}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="citation__title">{first.title}</span>
                <span className="citation__loc">
                  {first.documentId} · {citations.map((c) => c.locator).join(' · ')} · score{' '}
                  {Math.max(...citations.map((c) => c.score)).toFixed(2)}
                </span>
                <div className="citation__sections">
                  {citations.map((c) => (
                    <p className="citation__snippet" key={c.ref}>
                      <span className="mono">[{c.ref}] {c.locator}</span>
                      {' '}
                      {c.snippet}
                    </p>
                  ))}
                </div>
                <span style={{ display: 'inline-block', marginTop: 'var(--sp-2)' }}>
                  <Badge tone="neutral">{DOC_KIND_LABEL[first.kind]}</Badge>
                </span>
              </span>
            </button>
            )
          })
        )}
      </Section>

      <PreviousEvidenceTurns history={history} onCitationClick={onCitationClick} />
    </>
  )
}

function AlarmSummaryCard({ summary }: { summary: NonNullable<AnswerBlock['summary']> }) {
  const total = SEV_ORDER.reduce((n, s) => n + summary.bySeverity[s], 0) || 1

  return (
    <section className="card">
      <header className="card__head">
        <h3 className="card__title">
          <FileWarning size={13} />
          Alarm summary
        </h3>
        <div className="card__actions">
          <Badge tone="neutral">{summary.windowLabel.split(' · ')[0]}</Badge>
        </div>
      </header>
      <div className="card__body col">
        <div className="alarm-hero">
          <div className="alarm-hero__name">{summary.assetName}</div>
          <div className="alarm-hero__meta">
            <span className="mono">{summary.assetId}</span>
            <span>·</span>
            <span>{summary.site}</span>
            <span>·</span>
            <span>{summary.unit}</span>
          </div>
          <div className="row row--wrap" style={{ marginTop: 'var(--sp-1)' }}>
            <Badge tone="critical">{summary.activeAlarms} active</Badge>
            <Badge tone="neutral">Top: {summary.topAlarmName}</Badge>
          </div>
        </div>

        <div className="stats">
          <StatTile label="Total alarms" value={summary.totalAlarms} hint={summary.windowLabel.split(' · ')[1]} />
          <StatTile label="Recurrence" value={pct(summary.recurringRate)} hint="repeat / total" />
          <StatTile label="Avg ack delay" value={`${summary.avgAckDelayMin}m`} hint="operator response" />
          <StatTile label="Priority score" value={summary.priorityScore} hint="composite, 0–100" />
        </div>

        <div className="col" style={{ gap: 'var(--sp-2)' }}>
          <div className="sevbar">
            {SEV_ORDER.map((s) =>
              summary.bySeverity[s] > 0 ? (
                <span
                  key={s}
                  className="sevbar__seg"
                  style={{ width: `${(summary.bySeverity[s] / total) * 100}%`, background: SEV_VAR[s] }}
                  title={`${s}: ${summary.bySeverity[s]}`}
                />
              ) : null,
            )}
          </div>
          <div className="sevbar__legend">
            {SEV_ORDER.map((s) => (
              <span className="sevbar__key" key={s}>
                <span className="sevbar__swatch" style={{ background: SEV_VAR[s] }} />
                {s} <span className="mono">{summary.bySeverity[s]}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function AgreementTag({ agreement }: { agreement: AnswerBlock['recommendations'][number]['agreement'] }) {
  if (agreement === 'match') {
    return (
      <span className="agree agree--match">
        <ShieldCheck size={11} />
        API and document agree
      </span>
    )
  }
  if (agreement === 'conflict') {
    return (
      <span className="agree agree--conflict">
        <GitCompareArrows size={11} />
        Guidance differs — review
      </span>
    )
  }
  return (
    <span className="subtle" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <BookText size={11} />
      {agreement === 'doc-only' ? 'Document only' : 'Source system only'}
    </span>
  )
}

/* --- Trace tab -------------------------------------------------------- */

function TracePanel({ answer, history }: { answer: AnswerBlock; history: CompletedTurn[] }) {
  const total = answer.toolCalls.reduce((n, c) => n + c.durationMs, 0)
  const retries = answer.toolCalls.reduce((n, c) => n + Math.max(0, c.attempts - 1), 0)
  const failed = answer.toolCalls.filter((c) => c.status === 'error').length

  return (
    <>
      <div className="trace__meta">
        <span>trace_id trace-8f2a41c9</span>
        <span>conversation conv-4471</span>
        <span>tools {answer.toolCalls.length}</span>
        <span>retries {retries}</span>
        <span>total {ms(total)}</span>
      </div>

      {failed > 0 && (
        <WarnBox
          title={`${failed} tool call failed`}
          body="The orchestrator continued with the remaining evidence rather than aborting the request."
        />
      )}

      <TraceList calls={answer.toolCalls} />
      <PreviousTraceTurns history={history} />
    </>
  )
}

function PreviousEvidenceTurns({
  history,
  onCitationClick,
}: {
  history: CompletedTurn[]
  onCitationClick: (c: Citation) => void
}) {
  if (history.length === 0) return null

  return (
    <div className="rail-history">
      <div className="rail-history__label">Previous turns</div>
      {[...history].reverse().map((turn, index) => {
        const sourceCount = citationDocumentCount(turn.answer.citations)
        return (
          <details className="rail-turn" key={turn.id}>
            <summary>
              <ChevronRight size={13} className="rail-turn__chev" />
              <span className="rail-turn__title">Turn {history.length - index}</span>
              <span className="rail-turn__question">{turn.question}</span>
              <Badge tone={sourceCount === 0 ? 'warn' : 'neutral'}>
                {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
              </Badge>
            </summary>
            <div className="rail-turn__body">
              {turn.answer.citations.length === 0 ? (
                <p className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
                  No document evidence was cited for this turn.
                </p>
              ) : (
                groupedCitations(turn.answer.citations).map((citations) => {
                  const first = citations[0]
                  return (
                    <button
                      type="button"
                      className="citation"
                      key={`${turn.id}-${first.documentId}`}
                      onClick={() => onCitationClick(first)}
                    >
                      <span className="citation__marker">{citations.map((c) => c.ref).join(',')}</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span className="citation__title">{first.title}</span>
                        <span className="citation__loc">
                          {first.documentId} · {citations.map((c) => c.locator).join(' · ')}
                        </span>
                        <div className="citation__sections">
                          {citations.map((c) => (
                            <p className="citation__snippet" key={c.ref}>
                              <span className="mono">[{c.ref}] {c.locator}</span>
                              {' '}
                              {c.snippet}
                            </p>
                          ))}
                        </div>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </details>
        )
      })}
    </div>
  )
}

function PreviousTraceTurns({ history }: { history: CompletedTurn[] }) {
  if (history.length === 0) return null

  return (
    <div className="rail-history">
      <div className="rail-history__label">Previous turns</div>
      {[...history].reverse().map((turn, index) => (
        <details className="rail-turn" key={turn.id}>
          <summary>
            <ChevronRight size={13} className="rail-turn__chev" />
            <span className="rail-turn__title">Turn {history.length - index}</span>
            <span className="rail-turn__question">{turn.question}</span>
            <Badge tone={turn.answer.toolCalls.length === 0 ? 'warn' : 'neutral'}>
              {turn.answer.toolCalls.length} calls
            </Badge>
          </summary>
          <div className="rail-turn__body">
            {turn.answer.toolCalls.length === 0 ? (
              <p className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
                No MCP calls were recorded for this turn.
              </p>
            ) : (
              <TraceList calls={turn.answer.toolCalls} />
            )}
          </div>
        </details>
      ))}
    </div>
  )
}

/* --- Shared ----------------------------------------------------------- */

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: React.ReactNode
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="card">
      <header className="card__head">
        <h3 className="card__title">
          {icon}
          {title}
        </h3>
        {count !== undefined && (
          <div className="card__actions">
            <span className="rail__tab-count">{count}</span>
          </div>
        )}
      </header>
      <div className="card__body col" style={{ gap: 'var(--sp-2)' }}>
        {children}
      </div>
    </section>
  )
}

function RailSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div className="card" key={i}>
          <div className="card__body skel-stack">
            <div className="skel" style={{ width: '40%', height: 12 }} />
            <div className="skel" style={{ width: '100%', height: 44 }} />
            <div className="skel" style={{ width: '78%', height: 12 }} />
          </div>
        </div>
      ))}
    </>
  )
}
