import type { AnswerBlock } from './types'

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? ''

export interface ChatResponse {
  requestId: string
  conversationId: string
  createdAt: string
  durationMs: number
  answer: AnswerBlock
  state: unknown
}

export async function askCopilot(question: string): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.error?.message ?? `Backend returned HTTP ${response.status}`
    throw new Error(message)
  }
  return payload as ChatResponse
}
