import { useCallback, useMemo, useRef, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { ChatPanel } from '../components/investigate/ChatPanel'
import { EvidenceRail } from '../components/investigate/EvidenceRail'
import { Drawer } from '../components/ui/Drawer'
import { Badge } from '../components/ui/primitives'
import type { AnswerBlock, ChatMessage, Citation, ConversationContext, StatusStep } from '../lib/types'
import { DOC_KIND_LABEL } from '../lib/format'
import { askCopilotStream } from '../lib/api'
import { INITIAL_MESSAGES } from '../mock/conversation'

/* --------------------------------------------------------------------------
   Investigation workspace.

   Questions are always submitted to the live backend. Recommended questions
   are prompt shortcuts only; no saved responses are rendered from the UI.
   -------------------------------------------------------------------------- */

let seq = 0
const nextId = () => `m${++seq}`

type CompletedTurn = {
  id: string
  question: string
  answer: AnswerBlock
  createdAt: string
}

function answerToContext(answer: AnswerBlock): string {
  const parts = [
    answer.headline,
    ...answer.paragraphs,
    answer.summary
      ? `Structured context: asset=${answer.summary.assetId}, assetName=${answer.summary.assetName}, site=${answer.summary.site}, unit=${answer.summary.unit}, topAlarm=${answer.summary.topAlarmName}, priorityScore=${answer.summary.priorityScore}.`
      : '',
    answer.recommendations.length
      ? `Recommendations: ${answer.recommendations.map((r) => r.text).join(' ')}`
      : '',
    answer.citations.length
      ? `Cited documents: ${answer.citations.map((c) => `${c.documentId} ${c.locator}`).join('; ')}`
      : '',
  ]
  return parts.filter(Boolean).join('\n').slice(0, 1800)
}

function previousTurnContext(messages: ChatMessage[]): ConversationContext | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const assistant = messages[i]
    if (assistant.role !== 'assistant' || assistant.state !== 'complete' || !assistant.answer) continue
    const user = [...messages.slice(0, i)].reverse().find((item) => item.role === 'user' && item.text)
    if (!user?.text) continue
    return {
      previousUser: user.text,
      previousAssistant: answerToContext(assistant.answer),
    }
  }
  return undefined
}

function completedTurnsFromMessages(messages: ChatMessage[]): CompletedTurn[] {
  const turns: CompletedTurn[] = []
  let lastQuestion = ''

  messages.forEach((message) => {
    if (message.role === 'user' && message.text) {
      lastQuestion = message.text
      return
    }

    if (message.role === 'assistant' && message.state === 'complete' && message.answer) {
      turns.push({
        id: message.id,
        question: lastQuestion || 'Previous question',
        answer: message.answer,
        createdAt: message.createdAt,
      })
    }
  })

  return turns
}

export function Investigate() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [activeAnswer, setActiveAnswer] = useState<AnswerBlock | null>(null)
  const [openCitation, setOpenCitation] = useState<Citation | null>(null)
  const [statusSteps, setStatusSteps] = useState<StatusStep[]>([])
  const timer = useRef<number | null>(null)
  const completedTurns = useMemo(() => completedTurnsFromMessages(messages), [messages])
  const railHistory = activeAnswer ? completedTurns.slice(0, -1) : completedTurns

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
      setActiveAnswer(null)
      setOpenCitation(null)
      setStatusSteps([])
      const context = previousTurnContext(messages)

      try {
        const response = await askCopilotStream(question, (step) => {
          setStatusSteps((prev) => [...prev, { ...step, id: step.id ?? `step-${prev.length + 1}` }])
        }, context)
        setActiveAnswer(response.answer)
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', createdAt: response.createdAt, answer: response.answer, state: 'complete' },
        ])
      } catch (error) {
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
      } finally {
        setPending(false)
      }
    },
    [messages, pending],
  )

  const reset = () => {
    if (timer.current) window.clearTimeout(timer.current)
    setMessages([])
    setActiveAnswer(null)
    setOpenCitation(null)
    setPending(false)
    setInput('')
    setStatusSteps([])
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
          </div>
          <ChatPanel
            messages={messages}
            pending={pending}
            statusSteps={statusSteps}
            input={input}
            onInput={setInput}
            onSend={() => submit(input)}
            onPreset={submit}
            onCitation={setOpenCitation}
            onReset={reset}
            onRetry={submit}
          />
        </div>

        <EvidenceRail
          answer={activeAnswer}
          history={railHistory}
          loading={pending}
          onCitationClick={setOpenCitation}
        />
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
            </div>

            <section className="card">
              <header className="card__head">
                <h3 className="card__title">Evidence text</h3>
              </header>
              <div className="card__body">
                <p style={{ fontSize: 'var(--text-md)', lineHeight: 1.65 }}>
                  {openCitation.evidenceText ?? openCitation.snippet}
                </p>
              </div>
            </section>
          </>
        )}
      </Drawer>
    </div>
  )
}
