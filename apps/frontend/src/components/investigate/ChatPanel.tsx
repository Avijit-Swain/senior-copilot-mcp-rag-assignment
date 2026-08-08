import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowUp, MessageSquareText, RotateCcw, Sparkles } from 'lucide-react'
import type { AnswerBlock, ChatMessage } from '../../lib/types'
import { Badge, EmptyState, ErrorBox, WarnBox } from '../ui/primitives'
import { clock } from '../../lib/format'
import { PRESET_QUESTIONS } from '../../mock/conversation'

/**
 * Splits answer prose on inline citation markers such as "[2]" and renders
 * each marker as a control that focuses the matching citation.
 */
function withCitations(text: string, onCitation: (ref: number) => void): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = /^\[(\d+)\]$/.exec(part)
    if (!m) return <span key={i}>{part}</span>
    const ref = Number(m[1])
    return (
      <button key={i} type="button" className="cite" onClick={() => onCitation(ref)} title={`Jump to source ${ref}`}>
        {ref}
      </button>
    )
  })
}

export function ChatPanel({
  messages,
  pending,
  input,
  onInput,
  onSend,
  onPreset,
  onCitation,
  onReset,
}: {
  messages: ChatMessage[]
  pending: boolean
  input: string
  onInput: (v: string) => void
  onSend: () => void
  onPreset: (q: string) => void
  onCitation: (ref: number) => void
  onReset: () => void
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, pending])

  // Grow the composer with its content up to the CSS max-height.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [input])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <section className="chat">
      <div className="chat__thread">
        <div className="chat__inner">
          {messages.length === 0 && !pending && (
            <EmptyState
              icon={<MessageSquareText size={20} />}
              title="Start an alarm investigation"
              body="Ask about an asset, an alarm pattern or a procedure. The copilot resolves the asset, chains MCP tools against the Alarm Management API, retrieves matching site documentation and answers with citations."
            />
          )}

          {messages.map((m) =>
            m.role === 'user' ? (
              <UserMessage key={m.id} message={m} />
            ) : (
              <AssistantMessage key={m.id} message={m} onCitation={onCitation} />
            ),
          )}

          {pending && <PendingMessage />}
          <div ref={endRef} />
        </div>
      </div>

      <div className="composer">
        <div className="composer__inner">
          <div className="composer__presets">
            {PRESET_QUESTIONS.map((q) => (
              <button key={q} type="button" className="chip" onClick={() => onPreset(q)} disabled={pending}>
                <Sparkles size={11} />
                {q.length > 58 ? `${q.slice(0, 58)}…` : q}
              </button>
            ))}
          </div>

          <div className="composer__box">
            <textarea
              ref={boxRef}
              rows={1}
              value={input}
              placeholder="Ask about an alarm, an asset or a procedure…"
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={handleKey}
              aria-label="Ask the alarm copilot"
            />
            <button
              type="button"
              className="composer__send"
              onClick={onSend}
              disabled={!input.trim() || pending}
              aria-label="Send"
            >
              <ArrowUp size={16} />
            </button>
          </div>

          <div className="composer__hint">
            <span>
              <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
            </span>
            {messages.length > 0 && (
              <button type="button" className="btn btn--ghost btn--sm spacer" onClick={onReset}>
                <RotateCcw size={12} />
                New investigation
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <article className="msg msg--user">
      <div className="msg__avatar msg__avatar--user">You</div>
      <div className="msg__content">
        <div className="msg__author">
          Operator
          <span className="msg__time">{clock(message.createdAt)}</span>
        </div>
        <div className="msg__body">{message.text}</div>
      </div>
    </article>
  )
}

function AssistantMessage({
  message,
  onCitation,
}: {
  message: ChatMessage
  onCitation: (ref: number) => void
}) {
  return (
    <article className="msg">
      <div className="msg__avatar msg__avatar--bot">AI</div>
      <div className="msg__content">
        <div className="msg__author">
          Alarm Copilot
          <span className="msg__time">{clock(message.createdAt)}</span>
        </div>

        {message.state === 'error' ? (
          <ErrorBox
            title="The investigation could not be completed"
            body={message.errorText ?? 'An unexpected error occurred.'}
            action={
              <button type="button" className="btn btn--sm">
                <RotateCcw size={12} />
                Retry
              </button>
            }
          />
        ) : (
          message.answer && <AnswerBody answer={message.answer} onCitation={onCitation} />
        )}
      </div>
    </article>
  )
}

function AnswerBody({ answer, onCitation }: { answer: AnswerBlock; onCitation: (ref: number) => void }) {
  return (
    <div className="msg__body">
      {answer.degraded && (
        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <WarnBox title="Partial result" body={answer.degraded.reason} />
        </div>
      )}
      {answer.lowConfidence && (
        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <WarnBox
            title="Not enough document evidence to answer procedurally"
            body={answer.lowConfidence.reason}
          />
        </div>
      )}

      <p style={{ fontWeight: 600 }}>{answer.headline}</p>
      {answer.paragraphs.map((p, i) => (
        <p key={i}>{withCitations(p, onCitation)}</p>
      ))}

      {answer.recommendations.length > 0 && (
        <div className="msg__section">
          <div className="msg__section-title">Recommended actions</div>
          <ol className="msg__list">
            {answer.recommendations.map((r) => (
              <li key={r.id}>
                {r.text}{' '}
                {r.citationRefs.map((ref) => (
                  <button key={ref} type="button" className="cite" onClick={() => onCitation(ref)}>
                    {ref}
                  </button>
                ))}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="msg__footer">
        <Badge tone="neutral">{answer.toolCalls.length} MCP calls</Badge>
        <Badge tone={answer.citations.length === 0 ? 'warn' : 'neutral'}>
          {answer.citations.length} sources
        </Badge>
        {answer.degraded ? (
          <Badge tone="warn">degraded</Badge>
        ) : answer.lowConfidence ? (
          <Badge tone="warn">low confidence</Badge>
        ) : (
          <Badge tone="ok">grounded</Badge>
        )}
      </div>
    </div>
  )
}

function PendingMessage() {
  const steps = [
    'Discovering MCP tools',
    'Resolving asset identifier',
    'Retrieving alarm history',
    'Correlating alarm pairs',
    'Searching site documentation',
  ]
  return (
    <article className="msg">
      <div className="msg__avatar msg__avatar--bot">AI</div>
      <div className="msg__content">
        <div className="msg__author">
          Alarm Copilot
          <span className="typing">
            <span />
            <span />
            <span />
          </span>
        </div>
        <div className="col" style={{ gap: 'var(--sp-2)' }}>
          {steps.map((s, i) => (
            <div key={s} className="row" style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
              <span className={`dot dot--${i < 3 ? 'ok' : 'idle'}${i === 3 ? ' dot--pulse' : ''}`} />
              {s}
            </div>
          ))}
          <div className="skel-stack" style={{ marginTop: 'var(--sp-2)' }}>
            <div className="skel" style={{ width: '100%', height: 12 }} />
            <div className="skel" style={{ width: '92%', height: 12 }} />
            <div className="skel" style={{ width: '64%', height: 12 }} />
          </div>
        </div>
      </div>
    </article>
  )
}
