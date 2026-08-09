import type {
  AnswerBlock,
  ConversationContext,
  KnowledgeSearchResponse,
  StatusStep,
  StructuredPreviewResponse,
} from './types'

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? ''

export interface ChatResponse {
  requestId: string
  conversationId: string
  createdAt: string
  durationMs: number
  answer: AnswerBlock
  state: unknown
}

export async function askCopilot(question: string, conversationContext?: ConversationContext): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, conversationContext }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.error?.message ?? `Backend returned HTTP ${response.status}`
    throw new Error(message)
  }
  return payload as ChatResponse
}

export async function searchKnowledge(query: string, topK = 5, signal?: AbortSignal): Promise<KnowledgeSearchResponse> {
  const params = new URLSearchParams({ q: query, topK: String(topK) })
  const response = await fetch(`${API_BASE}/api/knowledge/search?${params}`, { signal })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.error?.message ?? `Backend returned HTTP ${response.status}`
    throw new Error(message)
  }
  return payload as KnowledgeSearchResponse
}

export function knowledgePdfUrl(documentId: string): string {
  return `${API_BASE}/api/knowledge/documents/${encodeURIComponent(documentId)}/pdf`
}

export async function getStructuredPreview(sampleSize = 5, signal?: AbortSignal): Promise<StructuredPreviewResponse> {
  const params = new URLSearchParams({ sampleSize: String(sampleSize) })
  const response = await fetch(`${API_BASE}/api/structured/preview?${params}`, { signal })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.error?.message ?? `Backend returned HTTP ${response.status}`
    throw new Error(message)
  }
  return payload as StructuredPreviewResponse
}

type StreamEvent = {
  event: string
  data: unknown
}

function parseSseChunk(buffer: string): { events: StreamEvent[]; rest: string } {
  const parts = buffer.split(/\n\n/)
  const rest = parts.pop() ?? ''
  const events = parts
    .map((part) => {
      const lines = part.split(/\n/)
      const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() ?? 'message'
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      if (!data) return null
      return { event, data: JSON.parse(data) as unknown }
    })
    .filter((event): event is StreamEvent => event !== null)
  return { events, rest }
}

export async function askCopilotStream(
  question: string,
  onStep: (step: StatusStep) => void,
  conversationContext?: ConversationContext,
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, conversationContext }),
  })

  if (!response.ok || !response.body) {
    return askCopilot(question, conversationContext)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer: ChatResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parsed = parseSseChunk(buffer)
    buffer = parsed.rest

    for (const item of parsed.events) {
      if (item.event === 'step.completed') {
        onStep(item.data as StatusStep)
      } else if (item.event === 'answer.completed') {
        answer = item.data as ChatResponse
      } else if (item.event === 'error') {
        const payload = item.data as { message?: string }
        throw new Error(payload.message ?? 'The backend stream returned an error.')
      }
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseChunk(`${buffer}\n\n`)
    for (const item of parsed.events) {
      if (item.event === 'answer.completed') answer = item.data as ChatResponse
      if (item.event === 'step.completed') onStep(item.data as StatusStep)
    }
  }

  if (!answer) throw new Error('The backend stream ended before returning an answer.')
  return answer
}
