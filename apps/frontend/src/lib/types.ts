/* --------------------------------------------------------------------------
   Domain types shared across the UI.

   These mirror the contracts the backend/MCP layer will eventually return.
   Keeping them here means swapping mock data for live data is a change of
   data source only, not a change of component code.
   -------------------------------------------------------------------------- */

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type ToolStatus = 'ok' | 'error' | 'running' | 'skipped' | 'retrying'
export type ServiceStatus = 'ok' | 'degraded' | 'down' | 'unknown'

/* --- Alarm domain ----------------------------------------------------- */

export interface Asset {
  assetId: string
  name: string
  type: string
  site: string
  unit: string
  criticality: Severity
}

export interface AlarmSummary {
  assetId: string
  assetName: string
  site: string
  unit: string
  windowLabel: string
  totalAlarms: number
  activeAlarms: number
  bySeverity: Record<Severity, number>
  topAlarmName: string
  recurringRate: number
  avgAckDelayMin: number
  priorityScore: number
}

export interface LikelyCause {
  id: string
  title: string
  description: string
  confidence: number
  evidence: string[]
  citationRefs: number[]
}

export interface Recommendation {
  id: string
  step: number
  text: string
  origin: 'api' | 'document' | 'both'
  citationRefs: number[]
  /** Whether API guidance and document guidance agree on this action. */
  agreement: 'match' | 'conflict' | 'api-only' | 'doc-only'
}

/* --- RAG -------------------------------------------------------------- */

export type DocKind =
  | 'operating-procedure'
  | 'maintenance-manual'
  | 'troubleshooting-guide'
  | 'safety-instruction'
  | 'alarm-philosophy'

export interface Citation {
  ref: number
  documentId: string
  title: string
  kind: DocKind
  locator: string
  snippet: string
  score: number
  chunkId: string
}

export interface CorpusDocument {
  documentId: string
  title: string
  kind: DocKind
  version: string
  pages: number
  chunks: number
  sizeKb: number
  updatedAt: string
  status: 'indexed' | 'pending' | 'failed'
  tags: string[]
}

export interface RetrievedChunk {
  chunkId: string
  documentId: string
  documentTitle: string
  locator: string
  text: string
  score: number
  tokens: number
}

/* --- MCP -------------------------------------------------------------- */

export interface McpServerInfo {
  id: string
  name: string
  transport: 'stdio' | 'streamable-http' | 'sse'
  url: string
  status: ServiceStatus
  protocolVersion: string
  toolCount: number
  latencyMs: number | null
}

export interface McpToolParam {
  name: string
  type: string
  required: boolean
  description: string
}

export interface McpTool {
  name: string
  serverId: string
  title: string
  description: string
  operation: string
  input: McpToolParam[]
  output: McpToolParam[]
  timeoutMs: number
  retries: number
  authScope: string
  errorCodes: { code: string; meaning: string }[]
  exampleInput: unknown
  exampleOutput: unknown
}

export interface McpToolCall {
  id: string
  index: number
  toolName: string
  serverId: string
  status: ToolStatus
  durationMs: number
  attempts: number
  httpStatus: number | null
  request: unknown
  response: unknown
  error?: { code: string; message: string }
  startedAt: string
}

/* --- Conversation ----------------------------------------------------- */

export interface AnswerBlock {
  headline: string
  paragraphs: string[]
  summary: AlarmSummary | null
  causes: LikelyCause[]
  recommendations: Recommendation[]
  citations: Citation[]
  toolCalls: McpToolCall[]
  /** Set when retrieval confidence fell below the configured floor. */
  lowConfidence?: { reason: string; topScore: number; floor: number }
  /** Set when part of the workflow failed but an answer was still produced. */
  degraded?: { reason: string; failedTools: string[] }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  createdAt: string
  text?: string
  answer?: AnswerBlock
  state: 'complete' | 'streaming' | 'error'
  errorText?: string
}

/* --- Observability ---------------------------------------------------- */

export interface TraceRecord {
  traceId: string
  requestId: string
  conversationId: string
  question: string
  startedAt: string
  totalMs: number
  llmMs: number
  retrievalMs: number
  toolCount: number
  retryCount: number
  retrievedDocs: number
  topScore: number
  outcome: 'success' | 'degraded' | 'failed'
  calls: McpToolCall[]
}

/* --- Config ----------------------------------------------------------- */

export interface EnvSetting {
  key: string
  value: string
  secret: boolean
  description: string
  source: 'env' | 'default'
}

export interface HealthCheck {
  id: string
  name: string
  url: string
  status: ServiceStatus
  latencyMs: number | null
  detail: string
}
