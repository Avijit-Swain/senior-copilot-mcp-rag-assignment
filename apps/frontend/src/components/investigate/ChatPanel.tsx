import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, MessageSquareText, Mic, MicOff, RotateCcw, Sparkles } from 'lucide-react'
import type { AnswerBlock, ChatMessage, Citation, StatusStep } from '../../lib/types'
import { Badge, EmptyState, ErrorBox, WarnBox } from '../ui/primitives'
import { clock } from '../../lib/format'
import { PRESET_QUESTIONS } from '../../mock/conversation'

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((event?: { error?: string }) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    0: {
      transcript: string
    }
  }>
}

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

/**
 * Splits answer prose on inline citation markers such as "[2]" and renders
 * each marker as a control that focuses the matching citation.
 */
function citationForRef(citations: Citation[], ref: number): Citation | undefined {
  return citations.find((citation) => citation.ref === ref)
}

function withCitations(text: string, citations: Citation[], onCitation: (citation: Citation) => void): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = /^\[(\d+)\]$/.exec(part)
    if (!m) return <span key={i}>{part}</span>
    const ref = Number(m[1])
    const citation = citationForRef(citations, ref)
    return (
      <button
        key={i}
        type="button"
        className="cite"
        onClick={() => citation && onCitation(citation)}
        disabled={!citation}
        title={`Show evidence ${ref}`}
      >
        {ref}
      </button>
    )
  })
}

export function ChatPanel({
  messages,
  pending,
  statusSteps,
  input,
  onInput,
  onSend,
  onPreset,
  onCitation,
  onReset,
  onRetry,
}: {
  messages: ChatMessage[]
  pending: boolean
  statusSteps: StatusStep[]
  input: string
  onInput: (v: string) => void
  onSend: () => void
  onPreset: (q: string) => void
  onCitation: (citation: Citation) => void
  onReset: () => void
  onRetry: (q: string) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechBaseRef = useRef('')
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const [listening, setListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean((window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, pending])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!suggestionsOpen) return

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!suggestionsRef.current?.contains(event.target as Node)) {
        setSuggestionsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress)
  }, [suggestionsOpen])

  // Grow the composer with its content up to the CSS max-height.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    if (!input.trim()) {
      el.style.height = ''
      return
    }
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [input])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  const handleSend = () => {
    if (listening) stopListening()
    setSuggestionsOpen(false)
    onSend()
  }

  const handlePreset = (question: string) => {
    if (listening) stopListening()
    setSuggestionsOpen(false)
    onPreset(question)
  }

  const toggleListening = () => {
    if (!speechSupported) {
      setSpeechError('Voice input is not available in this browser.')
      return
    }

    if (listening) {
      stopListening()
      return
    }

    const SpeechRecognition =
      (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    speechBaseRef.current = input.trim()
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript
      }
      const spokenText = transcript.trim()
      const nextInput = [speechBaseRef.current, spokenText].filter(Boolean).join(' ')
      onInput(nextInput)
    }

    recognition.onerror = (event) => {
      const denied = event?.error === 'not-allowed' || event?.error === 'service-not-allowed'
      setSpeechError(denied ? 'Microphone permission is blocked.' : 'Voice input stopped. Try again.')
      setListening(false)
      recognitionRef.current = null
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    try {
      setSpeechError(null)
      recognition.start()
      setListening(true)
    } catch {
      setSpeechError('Voice input could not start.')
      recognitionRef.current = null
      setListening(false)
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

          {messages.map((m, index) => {
            if (m.role === 'user') return <UserMessage key={m.id} message={m} />
            const retryQuestion =
              m.state === 'error'
                ? [...messages.slice(0, index)].reverse().find((item) => item.role === 'user')?.text
                : undefined
            return (
              <AssistantMessage
                key={m.id}
                message={m}
                onCitation={onCitation}
                onRetry={retryQuestion ? () => onRetry(retryQuestion) : undefined}
              />
            )
          })}

          {pending && <PendingMessage steps={statusSteps} />}
          <div ref={endRef} />
        </div>
      </div>

      <div className="composer">
        <div className="composer__inner">
          <div className="composer__box-wrap" ref={suggestionsRef}>
            {suggestionsOpen && (
              <div className="composer__suggestion-popover" role="menu" aria-label="Suggested questions">
                {PRESET_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="composer__suggestion-item"
                    onClick={() => handlePreset(q)}
                    disabled={pending}
                    role="menuitem"
                  >
                    <Sparkles size={13} />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="composer__box">
              <textarea
                ref={boxRef}
                rows={1}
                value={input}
                placeholder="Ask about alarms, assets, procedures..."
                onChange={(e) => onInput(e.target.value)}
                onKeyDown={handleKey}
                aria-label="Ask the alarm copilot"
              />
              <button
                type="button"
                className={`composer__suggestion-toggle${suggestionsOpen ? ' is-active' : ''}`}
                onClick={() => setSuggestionsOpen((open) => !open)}
                disabled={pending}
                aria-label="Show suggested questions"
                aria-expanded={suggestionsOpen}
                title="Suggested questions"
              >
                <Sparkles size={16} />
                <span>Suggestions</span>
              </button>
              <button
                type="button"
                className={`composer__mic${listening ? ' is-listening' : ''}`}
                onClick={toggleListening}
                disabled={pending}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                title={speechSupported ? 'Speak your question' : 'Voice input is not available in this browser'}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button
                type="button"
                className="composer__send"
                onClick={handleSend}
                disabled={!input.trim() || pending}
                aria-label="Send"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>

          {(speechError || messages.length > 0) && (
            <div className="composer__hint">
              {speechError && <span className="composer__voice-error">{speechError}</span>}
              {messages.length > 0 && (
                <button type="button" className="btn btn--ghost btn--sm spacer" onClick={onReset}>
                  <RotateCcw size={12} />
                  New investigation
                </button>
              )}
            </div>
          )}
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
  onRetry,
}: {
  message: ChatMessage
  onCitation: (citation: Citation) => void
  onRetry?: () => void
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
              <button type="button" className="btn btn--sm" onClick={onRetry} disabled={!onRetry}>
                <RotateCcw size={12} />
                Retry
              </button>
            }
          />
        ) : (
          message.answer && (
            <AnswerBody
              answer={message.answer}
              onCitation={onCitation}
            />
          )
        )}
      </div>
    </article>
  )
}

function AnswerBody({
  answer,
  onCitation,
}: {
  answer: AnswerBlock
  onCitation: (citation: Citation) => void
}) {
  const sourceCount = new Set(answer.citations.map((c) => c.documentId)).size
  return (
    <div className="msg__body msg__body--answer">
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
        <p key={i}>{withCitations(p, answer.citations, onCitation)}</p>
      ))}

      {answer.recommendations.length > 0 && (
        <div className="msg__section">
          <div className="msg__section-title">Recommended actions</div>
          <ol className="msg__list">
            {answer.recommendations.map((r) => (
              <li key={r.id}>
                {r.text}{' '}
                {r.citationRefs.map((ref) => {
                  const citation = citationForRef(answer.citations, ref)
                  return (
                    <button
                      key={ref}
                      type="button"
                      className="cite"
                      onClick={() => citation && onCitation(citation)}
                      disabled={!citation}
                    >
                      {ref}
                    </button>
                  )
                })}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="msg__footer">
        <Badge tone="neutral">{answer.toolCalls.length} MCP calls</Badge>
        <Badge tone={sourceCount === 0 ? 'warn' : 'neutral'}>
          {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
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

function PendingMessage({ steps }: { steps: StatusStep[] }) {
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
          {steps.length === 0 ? (
            <div className="row" style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
              <span className="dot dot--idle dot--pulse" />
              Waiting for completed tool evidence
            </div>
          ) : (
            steps.map((step) => (
              <div key={step.id} className="status-step">
                <span className={`dot dot--${step.status === 'error' ? 'err' : step.status}`} />
                <span className="status-step__source">
                  {step.source === 'mcp' ? step.tool ?? step.server ?? 'MCP' : step.source === 'rag' ? 'RAG' : 'Orchestrator'}
                </span>
                <span className="status-step__label">{step.label}</span>
                {typeof step.durationMs === 'number' && step.durationMs > 0 && (
                  <span className="status-step__meta">{step.durationMs} ms</span>
                )}
              </div>
            ))
          )}
          <div className="row" style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
            <span className="dot dot--idle dot--pulse" />
            Synthesizing answer
          </div>
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
