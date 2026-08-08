import { useMemo, useState } from 'react'
import {
  BookOpen,
  DatabaseZap,
  FileText,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import type { CorpusDocument } from '../lib/types'
import { CORPUS, SAMPLE_CHUNKS } from '../mock/corpus'
import { Badge, Card, EmptyState, StatTile } from '../components/ui/primitives'
import { Drawer } from '../components/ui/Drawer'
import { JsonView } from '../components/ui/JsonView'
import { DOC_KIND_LABEL } from '../lib/format'

/* --------------------------------------------------------------------------
   RAG corpus view: ingestion status, document metadata and a retrieval
   preview. Placeholder data until the ingestion pipeline writes a manifest.
   -------------------------------------------------------------------------- */

export function KnowledgeBase() {
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState('')
  const [selected, setSelected] = useState<CorpusDocument | null>(null)

  const docs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CORPUS
    return CORPUS.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.documentId.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [query])

  const indexed = CORPUS.filter((d) => d.status === 'indexed')
  const totalChunks = indexed.reduce((n, d) => n + d.chunks, 0)
  const hasPreview = preview.trim().length > 0

  return (
    <div className="page page--scroll">
      <div className="page__inner">
        <div className="page__head">
          <div>
            <h2>Document corpus</h2>
            <p>
              Operating procedures, maintenance manuals, troubleshooting guides and safety instructions
              backing the copilot’s grounded answers. Every citation resolves to a chunk in this index.
            </p>
          </div>
          <div className="page__head-actions">
            <button type="button" className="btn">
              <Upload size={14} />
              Add document
            </button>
            <button type="button" className="btn btn--primary">
              <DatabaseZap size={14} />
              Re-ingest corpus
            </button>
          </div>
        </div>

        <div className="stats">
          <StatTile label="Documents" value={CORPUS.length} hint={`${indexed.length} indexed`} />
          <StatTile label="Chunks" value={totalChunks} hint="≈ 512 tokens, 64 overlap" />
          <StatTile label="Embedding model" value="bge-small" hint="384 dimensions" />
          <StatTile label="Retrieval" value="Hybrid" hint="vector 0.7 · BM25 0.3" />
          <StatTile label="Score floor" value="0.55" hint="below this → low confidence" />
        </div>

        <Card
          title="Retrieval preview"
          icon={<Search size={13} />}
          actions={<Badge tone="neutral">placeholder results</Badge>}
        >
          <div className="col">
            <label className="searchbox">
              <Search size={14} />
              <input
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
                placeholder="Try: what to check on low suction pressure"
                aria-label="Retrieval preview query"
              />
            </label>

            {!hasPreview ? (
              <EmptyState
                icon={<Search size={20} />}
                title="Run a retrieval"
                body="Enter a question to see which chunks would be retrieved, with their similarity scores and source locators."
              />
            ) : (
              <div className="col" style={{ gap: 'var(--sp-2)' }}>
                {SAMPLE_CHUNKS.map((c) => (
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
                        {c.documentTitle}
                      </span>
                      <span className="spacer score">{c.tokens} tokens</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="row row--wrap">
          <label className="searchbox" style={{ flex: 1, minWidth: 220 }}>
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter documents by title, id or tag…"
              aria-label="Filter documents"
            />
          </label>
          <Badge tone="neutral">
            {docs.length} of {CORPUS.length}
          </Badge>
        </div>

        {docs.length === 0 ? (
          <Card>
            <EmptyState icon={<BookOpen size={20} />} title="No documents match" body="Try a different keyword." />
          </Card>
        ) : (
          <div className="col" style={{ gap: 'var(--sp-3)' }}>
            {docs.map((d) => (
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
                  <span className="row row--wrap" style={{ marginTop: 'var(--sp-2)' }}>
                    <Badge tone="neutral">{DOC_KIND_LABEL[d.kind]}</Badge>
                    {d.tags.map((t) => (
                      <Badge tone="neutral" key={t}>
                        {t}
                      </Badge>
                    ))}
                  </span>
                  <span className="doccard__meta">
                    <span>{d.documentId}</span>
                    <span>{d.version}</span>
                    <span>{d.pages} pages</span>
                    <span>{d.chunks} chunks</span>
                    <span>{d.sizeKb} KB</span>
                    <span>updated {d.updatedAt}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <Card title="Prompt-injection handling" icon={<ShieldCheck size={13} />}>
          <p className="muted" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
            Retrieved passages are treated as untrusted data, never as instructions. Chunks are wrapped in
            a delimited data block, imperative directives found inside document text are stripped during
            ingestion, and the synthesis prompt is instructed to ignore any instruction that originates
            from retrieved content. Placeholder — the detector and its unit tests land with the ingestion
            pipeline.
          </p>
        </Card>
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

            <Card title="Chunk preview">
              <div className="col" style={{ gap: 'var(--sp-2)' }}>
                {SAMPLE_CHUNKS.slice(0, 2).map((c) => (
                  <div className="chunk" key={c.chunkId}>
                    <div className="chunk__head">
                      <span className="chunk__id">{c.chunkId}</span>
                      <span className="spacer subtle" style={{ fontSize: 'var(--text-2xs)' }}>
                        {c.locator}
                      </span>
                    </div>
                    <p className="chunk__text">{c.text}</p>
                  </div>
                ))}
              </div>
            </Card>

            <JsonView
              label="Document metadata"
              value={{
                document_id: selected.documentId,
                title: selected.title,
                kind: selected.kind,
                version: selected.version,
                pages: selected.pages,
                chunks: selected.chunks,
                tags: selected.tags,
                updated_at: selected.updatedAt,
                ingestion: {
                  extractor: 'pdfplumber',
                  chunker: 'recursive-heading-aware',
                  chunk_tokens: 512,
                  overlap_tokens: 64,
                  embedding_model: 'bge-small-en-v1.5',
                },
              }}
            />
          </>
        )}
      </Drawer>
    </div>
  )
}
