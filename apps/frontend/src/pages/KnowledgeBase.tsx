import { useState } from 'react'
import {
  FileText,
  RefreshCw,
  Search,
} from 'lucide-react'
import type { CorpusDocument, KnowledgeSearchResult } from '../lib/types'
import { CORPUS } from '../mock/corpus'
import { Badge, Card, EmptyState, ErrorBox, SkeletonBlock, StatTile } from '../components/ui/primitives'
import { Drawer } from '../components/ui/Drawer'
import { DOC_KIND_LABEL } from '../lib/format'
import { knowledgePdfUrl, searchKnowledge } from '../lib/api'

/* Unstructured data source view: local document metadata and live embedding retrieval preview. */

const DOC_SUMMARIES: Record<string, string> = {
  'SOP-114':
    'Operator response for boiler feed pump low suction pressure alarms: acknowledgement, suction-side checks, safe demand reduction, recurring-event diagnosis and escalation criteria.',
  'SOP-220':
    'Response procedure for compressor discharge pressure high alarms at EastRefinery Unit 3, including immediate checks, anti-surge context, repeated occurrences and escalation.',
  'MM-207':
    'Maintenance requirements for centrifugal pumps: seal and bearing inspection, vibration and temperature monitoring, deferral rules and mandatory removal-from-service criteria.',
  'TG-051':
    'Troubleshooting guide for pump cavitation and NPSH deficiency, covering acoustic/vibration symptoms, alarm pattern signatures and common suction-side causes.',
  'TG-088':
    'Investigation guide for motor trips and electrical faults, including protection-trip context, related assets and what to verify before inspection.',
  'SI-009':
    'Safety instruction for isolation of rotating equipment: work permits, stopping drives, lockout/tagout, stored-energy dissipation and zero-energy verification.',
  'AP-001':
    'Alarm philosophy and rationalisation standard covering alarm priority, operator actionability, flood handling, nuisance alarms and acknowledgement expectations.',
  'KB-3312':
    'Field knowledge article on recurring pump alarms after strainer changeover. It also acts as the prompt-injection fixture used to validate untrusted retrieved content handling.',
}

export function KnowledgeBase() {
  const [preview, setPreview] = useState('')
  const [submittedPreview, setSubmittedPreview] = useState('')
  const [previewResults, setPreviewResults] = useState<KnowledgeSearchResult[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CorpusDocument | null>(null)

  const indexed = CORPUS.filter((d) => d.status === 'indexed')
  const totalChunks = indexed.reduce((n, d) => n + d.chunks, 0)
  const previewQuery = preview.trim()
  const submittedQuery = submittedPreview.trim()
  const hasSubmittedPreview = submittedQuery.length > 0
  const acceptedResults = previewResults.filter((result) => result.passedRelevance)
  const rejectedCount = previewResults.length - acceptedResults.length

  async function runRetrieval() {
    if (previewQuery.length < 3) {
      return
    }

    setSubmittedPreview(previewQuery)
    setPreviewResults([])
    setPreviewLoading(true)
    setPreviewError(null)

    try {
      const payload = await searchKnowledge(previewQuery, 5)
      setPreviewResults(payload.results)
    } catch (error: unknown) {
      setPreviewError(error instanceof Error ? error.message : 'Knowledge search failed.')
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <div className="page page--scroll">
      <div className="page__inner">
        <div className="page__head">
          <div>
            <h2>Unstructured data source</h2>
            <p>
              Operating procedures, maintenance manuals, troubleshooting guides and safety instructions
              backing the copilot’s grounded answers. The local Chroma index contains representation
              vectors across these 8 PDFs for the unstructured RAG agent.
            </p>
          </div>
          <div className="page__head-actions">
            <button type="button" className="btn" disabled>
              <RefreshCw size={14} />
              Rebuild via script
            </button>
          </div>
        </div>

        <div className="stats">
          <StatTile label="Documents" value={CORPUS.length} hint={`${indexed.length} indexed`} />
          <StatTile label="Vectors" value={totalChunks} hint="multi-representation index" />
          <StatTile label="Embedding model" value="text-embedding-3-small" hint="OpenAI embeddings" />
          <StatTile label="Retrieval" value="Vector" hint="unique docs after overfetch" />
        </div>

        <Card
          title="Test RAG retrieval"
          icon={<Search size={13} />}
          actions={<Badge tone="neutral">embeddings</Badge>}
        >
          <div className="col">
            <form
              className="rag-search-form"
              onSubmit={(e) => {
                e.preventDefault()
                void runRetrieval()
              }}
            >
              <label className="searchbox">
                <Search size={14} />
                <input
                  value={preview}
                  onChange={(e) => setPreview(e.target.value)}
                  placeholder="Ask a retrieval question: pump removal from service, motor isolation..."
                  aria-label="Retrieval preview query"
                />
              </label>
              <button type="submit" className="btn btn--primary" disabled={previewQuery.length < 3 || previewLoading}>
                <Search size={14} />
                Search
              </button>
            </form>

            {!hasSubmittedPreview ? (
              <EmptyState
                icon={<Search size={20} />}
                title="Run the embedding pipeline"
                body="Enter a question and click Search to embed the query, search Chroma, overfetch vectors, dedupe to unique documents and show the relevance gate."
              />
            ) : previewLoading ? (
              <SkeletonBlock lines={4} />
            ) : previewError ? (
              <ErrorBox title="Knowledge search failed" body={previewError} />
            ) : acceptedResults.length === 0 ? (
              <EmptyState
                icon={<Search size={20} />}
                title="No embedding matches"
                body={`No relevant results for “${submittedQuery}”. Try a more specific alarm, asset or procedure term.`}
              />
            ) : (
              <div className="col" style={{ gap: 'var(--sp-2)' }}>
                {rejectedCount > 0 && (
                  <div className="rag-search-note">{rejectedCount} lower-confidence result{rejectedCount === 1 ? '' : 's'} filtered out.</div>
                )}
                {acceptedResults.map((c) => (
                  <div className="chunk" key={c.chunkId}>
                    <div className="chunk__head">
                      <span className="chunk__id">{c.chunkId}</span>
                      <span className="subtle" style={{ fontSize: 'var(--text-2xs)' }}>
                        {c.locator}
                      </span>
                      <span className="spacer">
                        <Badge tone={c.score >= 0.55 ? 'ok' : 'warn'}>score {c.score.toFixed(2)}</Badge>
                      </span>
                    </div>
                    <p className="chunk__text">{c.text}</p>
                    <div className="row" style={{ marginTop: 'var(--sp-2)' }}>
                      <span className="subtle" style={{ fontSize: 'var(--text-2xs)' }}>
                        {c.documentTitle} · {DOC_KIND_LABEL[c.kind]}
                      </span>
                      <span className="spacer score">{c.tokens} tokens</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="kb-library-head">
          <div>
            <h3>Indexed documents</h3>
            <p>The complete corpus available to the unstructured RAG agent.</p>
          </div>
          <Badge tone="neutral">
            {CORPUS.length} PDFs
          </Badge>
        </div>

        <div className="kb-doc-grid">
          {CORPUS.map((d) => (
            <button type="button" className="doccard" key={d.documentId} onClick={() => setSelected(d)}>
              <span className="doccard__icon">
                <FileText size={16} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="row row--wrap">
                  <span className="doccard__title">{d.title}</span>
                  <Badge tone={d.status === 'indexed' ? 'ok' : d.status === 'pending' ? 'warn' : 'err'}>
                    {d.status}
                  </Badge>
                </span>
                <p className="doccard__summary">{DOC_SUMMARIES[d.documentId]}</p>
                <span className="row row--wrap" style={{ marginTop: 'var(--sp-2)' }}>
                  <Badge tone="neutral">{DOC_KIND_LABEL[d.kind]}</Badge>
                  {d.tags.slice(0, 4).map((t) => (
                    <Badge tone="neutral" key={t}>
                      {t}
                    </Badge>
                  ))}
                </span>
                <span className="doccard__meta">
                  <span>{d.documentId}</span>
                  <span>{d.version}</span>
                  <span>{d.pages} pages</span>
                  <span>{d.chunks} vectors</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <Drawer
        open={selected !== null}
        title={selected?.title ?? ''}
        subtitle={selected ? `${selected.documentId} · ${selected.version}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <div className="row row--wrap">
              <Badge tone="neutral">{DOC_KIND_LABEL[selected.kind]}</Badge>
              <Badge tone={selected.status === 'indexed' ? 'ok' : 'warn'}>{selected.status}</Badge>
              <Badge tone="neutral">{selected.chunks} chunks</Badge>
            </div>

            <Card title="What this document contains">
              <div className="col">
                <p className="muted" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                  {DOC_SUMMARIES[selected.documentId]}
                </p>
                <a
                  className="btn btn--primary"
                  href={knowledgePdfUrl(selected.documentId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText size={14} />
                  Open complete PDF
                </a>
              </div>
            </Card>

            <Card title="Indexing behavior">
              <p className="muted" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                The preview above queries the same Chroma index used by the unstructured RAG agent.
                It searches representation vectors, overfetches 20 matches, deduplicates to unique
                documents, then shows the best matched representation for each document.
              </p>
            </Card>
          </>
        )}
      </Drawer>
    </div>
  )
}
