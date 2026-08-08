import { useState } from 'react'
import {
  BookText,
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

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low']
const SEV_VAR: Record<Severity, string> = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
}

export function EvidenceRail({
  answer,
  loading,
  onCitationClick,
}: {
  answer: AnswerBlock | null
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
          {answer && <span className="rail__tab-count">{answer.citations.length}</span>}
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
          {answer && <span className="rail__tab-count">{answer.toolCalls.length}</span>}
        </button>
      </div>

      <div className="rail__body">
        {loading && <RailSkeleton />}

        {!loading && !answer && (
          <EmptyState
            icon={<Sigma size={20} />}
            title="No investigation yet"
            body="Ask a question and the alarm summary, likely causes, recommended actions, citations and the full MCP tool trace will appear here."
          />
        )}

        {!loading && answer && tab === 'evidence' && (
          <EvidencePanel answer={answer} onCitationClick={onCitationClick} />
        )}

        {!loading && answer && tab === 'trace' && <TracePanel answer={answer} />}
      </div>
    </aside>
  )
}

/* --- Evidence tab ----------------------------------------------------- */

function EvidencePanel({
  answer,
  onCitationClick,
}: {
  answer: AnswerBlock
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

      <Section title="Document citations" icon={<Quote size={13} />} count={answer.citations.length}>
        {answer.citations.length === 0 ? (
          <p className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
            No document passage met the retrieval confidence floor, so nothing is cited.
          </p>
        ) : (
          answer.citations.map((c) => (
            <button type="button" className="citation" key={c.ref} onClick={() => onCitationClick(c)}>
              <span className="citation__marker">{c.ref}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="citation__title">{c.title}</span>
                <span className="citation__loc">
                  {c.documentId} · {c.locator} · score {c.score.toFixed(2)}
                </span>
                <p className="citation__snippet">{c.snippet}</p>
                <span style={{ display: 'inline-block', marginTop: 'var(--sp-2)' }}>
                  <Badge tone="neutral">{DOC_KIND_LABEL[c.kind]}</Badge>
                </span>
              </span>
            </button>
          ))
        )}
      </Section>
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

function TracePanel({ answer }: { answer: AnswerBlock }) {
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
    </>
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
