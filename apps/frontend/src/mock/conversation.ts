import type { ChatMessage, EnvSetting, HealthCheck, TraceRecord } from '../lib/types'

export const PRESET_QUESTIONS = [
  'Investigate recurring BFP-101 high-severity alarms and recommend cited actions.',
  'What should we do for the active Motor Trip on MTR-301 before inspection?',
  'Which EastRefinery alarm has the highest priority, and why?',
  'Do BFP-101 API recommendations match the manual and safety guidance?',
  'When should a centrifugal pump be removed from service instead of monitored?',
]

export const INITIAL_MESSAGES: ChatMessage[] = []

// The backend returns the MCP trace with each answer, but does not persist a
// cross-request trace history yet.
export const TRACES: TraceRecord[] = []

export const ENV_SETTINGS: EnvSetting[] = [
  {
    key: 'OPENAI_API_KEY',
    value: 'server-side only',
    secret: true,
    description: 'OpenAI credential used by master orchestration, structured planning, RAG answering and embeddings.',
    source: 'env',
  },
  {
    key: 'MASTER_MODEL',
    value: 'gpt-5.6-terra',
    secret: false,
    description: 'Model used by the master orchestrator and final synthesis.',
    source: 'default',
  },
  {
    key: 'STRUCTURED_AGENT_MODEL',
    value: 'gpt-4.1',
    secret: false,
    description: 'Model used by the structured MCP planner.',
    source: 'default',
  },
  {
    key: 'SUPERVISOR_MODEL',
    value: 'gpt-4.1',
    secret: false,
    description: 'Model used by the unstructured RAG supervisor.',
    source: 'default',
  },
  {
    key: 'TOOL_MODEL',
    value: 'gpt-4o-mini',
    secret: false,
    description: 'Model used by RAG retrieval tool nodes to answer from retrieved documents.',
    source: 'default',
  },
  {
    key: 'EMBEDDING_MODEL',
    value: 'text-embedding-3-small',
    secret: false,
    description: 'Embedding model used by the ingestion pipeline.',
    source: 'default',
  },
  {
    key: 'ALARM_API_BASE_URL',
    value: 'http://127.0.0.1:8000',
    secret: false,
    description: 'Base URL of the local Alarm Management API simulator.',
    source: 'default',
  },
  {
    key: 'ALARM_API_TOKEN',
    value: 'server-side only',
    secret: true,
    description: 'Bearer token presented by the MCP server to the Alarm API simulator. Never exposed to the browser.',
    source: 'env',
  },
  {
    key: 'MCP_SERVER_COMMAND',
    value: '.venv/bin/python',
    secret: false,
    description: 'Command used by the backend MCP client to start the stdio MCP server.',
    source: 'default',
  },
  {
    key: 'MCP_SERVER_ARGS',
    value: '-m alarm_mcp.server',
    secret: false,
    description: 'Arguments used to run the candidate-developed alarm-management MCP server.',
    source: 'default',
  },
  {
    key: 'MCP_TOOL_TIMEOUT_MS',
    value: '15000',
    secret: false,
    description: 'Default per-tool timeout used by the MCP server when calling the Alarm API.',
    source: 'default',
  },
  {
    key: 'MCP_TOOL_MAX_RETRIES',
    value: '2',
    secret: false,
    description: 'Maximum retry count for retriable Alarm API failures.',
    source: 'default',
  },
  {
    key: 'VECTOR_INDEX_PATH',
    value: './rag/index',
    secret: false,
    description: 'Local Chroma index path. Current index contains 52 vectors across 8 documents.',
    source: 'default',
  },
  {
    key: 'DOCUMENT_PATH',
    value: './rag/documents',
    secret: false,
    description: 'Source corpus directory scanned by the ingestion pipeline.',
    source: 'default',
  },
  {
    key: 'VITE_BACKEND_URL',
    value: 'http://127.0.0.1:8080',
    secret: false,
    description: 'Backend API URL used by the browser bundle.',
    source: 'default',
  },
]

export const HEALTH_CHECKS: HealthCheck[] = [
  {
    id: 'backend',
    name: 'Copilot Backend',
    url: 'http://127.0.0.1:8080/api/health',
    status: 'unknown',
    latencyMs: null,
    detail: 'Live status is available through /api/health; settings refresh is not wired yet.',
  },
  {
    id: 'alarm-api',
    name: 'Alarm Management API Simulator',
    url: 'http://127.0.0.1:8000/health',
    status: 'unknown',
    latencyMs: null,
    detail: 'Implemented in apps/backend/alarm_api with SQLite seed data.',
  },
  {
    id: 'alarm-mcp',
    name: 'Alarm MCP Server',
    url: '.venv/bin/python -m alarm_mcp.server',
    status: 'unknown',
    latencyMs: null,
    detail: 'Started on demand by the backend stdio MCP client; exposes 7 tools.',
  },
  {
    id: 'rag-index',
    name: 'RAG Index',
    url: './rag/index/chroma.sqlite3',
    status: 'ok',
    latencyMs: null,
    detail: '52 vectors across 8 indexed PDFs; eval retrieval precision@1 94%, recall@3 100%.',
  },
  {
    id: 'trace-store',
    name: 'Trace History Store',
    url: 'not implemented',
    status: 'unknown',
    latencyMs: null,
    detail: 'Per-answer MCP traces are returned to the Investigation rail; history persistence is pending.',
  },
]
