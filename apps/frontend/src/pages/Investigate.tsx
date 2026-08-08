import { useCallback, useRef, useState } from 'react'
import { FlaskConical, Wifi } from 'lucide-react'
import { ChatPanel } from '../components/investigate/ChatPanel'
import { EvidenceRail } from '../components/investigate/EvidenceRail'
import { Drawer } from '../components/ui/Drawer'
import { Badge, Segmented } from '../components/ui/primitives'
import { JsonView } from '../components/ui/JsonView'
import type { AnswerBlock, ChatMessage, Citation } from '../lib/types'
import { DOC_KIND_LABEL } from '../lib/format'
import { askCopilot } from '../lib/api'
import {
  DEGRADED_ANSWER,
  INITIAL_MESSAGES,
  LOW_CONFIDENCE_ANSWER,
  SAMPLE_ANSWER,
} from '../mock/conversation'

/* --------------------------------------------------------------------------
   Investigation workspace.

   Placeholder behaviour: sending a question resolves to one of four canned
   outcomes after a short delay. The `scenario` switch exists so every state
   the brief asks to demonstrate — success, degraded, low-confidence and hard
   failure — can be shown without needing the backend. Replaced by a real
   POST /chat stream once the orchestrator lands.
   -------------------------------------------------------------------------- */

type Scenario = 'success' | 'degraded' | 'low-confidence' | 'error'

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: 'success', label: 'Success' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'low-confidence', label: 'Low conf.' },
  { value: 'error', label: 'Failure' },
]

const ANSWER_FOR: Record<Exclude<Scenario, 'error'>, AnswerBlock> = {
  success: SAMPLE_ANSWER,
  degraded: DEGRADED_ANSWER,
  'low-confidence': LOW_CONFIDENCE_ANSWER,
}

let seq = 0
const nextId = () => `m${++seq}`

export function Investigate() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [scenario, setScenario] = useState<Scenario>('success')
  const [usingFallback, setUsingFallback] = useState(false)
  const [activeAnswer, setActiveAnswer] = useState<AnswerBlock | null>(null)
  const [openCitation, setOpenCitation] = useState<Citation | null>(null)
  const timer = useRef<number | null>(null)

  const submit = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || pending) return

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', createdAt: new Date().toISOString(), text: question, state: 'complete' },
      ])
      setInput('')
      setPending(true)
      setUsingFallback(false)

      try {
        const response = await askCopilot(question)
        setActiveAnswer(response.answer)
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', createdAt: response.createdAt, answer: response.answer, state: 'complete' },
        ])
      } catch (error) {
        setUsingFallback(true)
        if (scenario === 'error') {
          setActiveAnswer(null)
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: 'assistant',
              createdAt: new Date().toISOString(),
              state: 'error',
              errorText:
                error instanceof Error
                  ? error.message
                  : 'The backend is unavailable and the investigation could not be completed.',
            },
          ])
        } else {
          const answer = ANSWER_FOR[scenario]
          setActiveAnswer(answer)
          setMessages((prev) => [
            ...prev,
            { id: nextId(), role: 'assistant', createdAt: new Date().toISOString(), answer, state: 'complete' },
          ])
        }
      } finally {
        setPending(false)
      }
    },
    [pending, scenario],
  )

  const reset = () => {
    if (timer.current) window.clearTimeout(timer.current)
    setMessages([])
    setActiveAnswer(null)
    setPending(false)
    setUsingFallback(false)
    setInput('')
  }

  const focusCitation = (ref: number) => {
    const c = activeAnswer?.citations.find((x) => x.ref === ref)
    if (c) setOpenCitation(c)
  }

  return (
    <div className="page">
      <div className="invest">
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <div className="chat__toolbar">
            <FlaskConical size={13} className="subtle" />
            <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
              Live master orchestrator
            </span>
            <span className="spacer row" style={{ gap: 'var(--sp-2)' }}>
              {usingFallback && (
                <span className="subtle row" style={{ gap: 4, fontSize: 'var(--text-xs)' }}>
                  <Wifi size={12} /> fallback demo
                </span>
              )}
              <Segmented value={scenario} options={SCENARIOS} onChange={setScenario} />
            </span>
          </div>
          <ChatPanel
            messages={messages}
            pending={pending}
            input={input}
            onInput={setInput}
            onSend={() => submit(input)}
            onPreset={submit}
            onCitation={focusCitation}
            onReset={reset}
          />
        </div>

        <EvidenceRail answer={activeAnswer} loading={pending} onCitationClick={setOpenCitation} />
      </div>

      <Drawer
        open={openCitation !== null}
        title={openCitation?.title ?? ''}
        subtitle={
          openCitation ? `${openCitation.documentId} · ${openCitation.locator}` : undefined
        }
        onClose={() => setOpenCitation(null)}
      >
        {openCitation && (
          <>
            <div className="row row--wrap">
              <Badge tone="neutral">{DOC_KIND_LABEL[openCitation.kind]}</Badge>
              <Badge tone="ok">score {openCitation.score.toFixed(2)}</Badge>
              <span className="mono subtle" style={{ fontSize: 'var(--text-xs)' }}>
                {openCitation.chunkId}
              </span>
            </div>

            <section className="card">
              <header className="card__head">
                <h3 className="card__title">Retrieved passage</h3>
              </header>
              <div className="card__body">
                <p style={{ fontSize: 'var(--text-md)', lineHeight: 1.65 }}>{openCitation.snippet}</p>
              </div>
            </section>

            <JsonView
              label="Chunk metadata"
              value={{
                chunk_id: openCitation.chunkId,
                document_id: openCitation.documentId,
                locator: openCitation.locator,
                kind: openCitation.kind,
                similarity: openCitation.score,
                retrieval: { method: 'hybrid', vector_weight: 0.7, bm25_weight: 0.3 },
                trust: { source: 'internal-corpus', instructions_stripped: true },
              }}
            />
          </>
        )}
      </Drawer>
    </div>
  )
}
