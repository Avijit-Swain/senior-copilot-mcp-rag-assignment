import type {
  AnswerBlock,
  ChatMessage,
  Citation,
  EnvSetting,
  HealthCheck,
  LikelyCause,
  McpToolCall,
  Recommendation,
  TraceRecord,
} from '../lib/types'

/* --------------------------------------------------------------------------
   Placeholder conversation for the mandatory acceptance scenario:
   "Investigate recurring high-severity alarms for Boiler Feed Pump 101 over
   the last 90 days."

   Every field here is produced by the orchestrator at runtime once wired.
   -------------------------------------------------------------------------- */

export const PRESET_QUESTIONS = [
  'Investigate recurring high-severity alarms for Boiler Feed Pump 101 over the last 90 days',
  'Show active critical alarms for Boiler Feed Pump 102 and recommend immediate actions',
  'Why are compressor discharge pressure alarms repeatedly occurring?',
  'Which alarm has the highest priority in EastRefinery, and why?',
  'Are the API recommendations consistent with the maintenance manual?',
]

const TOOL_CALLS: McpToolCall[] = [
  {
    id: 'tc-1',
    index: 1,
    toolName: 'search_assets',
    serverId: 'alarm-management',
    status: 'ok',
    durationMs: 118,
    attempts: 1,
    httpStatus: 200,
    startedAt: '2026-08-08T09:14:02.114Z',
    request: { query: 'Boiler Feed Pump 101', limit: 5 },
    response: {
      results: [
        {
          asset_id: 'AST-1042',
          name: 'Boiler Feed Pump 101',
          type: 'pump',
          site: 'NorthPlant',
          unit: 'Unit 1',
          criticality: 'high',
        },
      ],
      match_score: 0.98,
    },
  },
  {
    id: 'tc-2',
    index: 2,
    toolName: 'get_asset_metadata',
    serverId: 'alarm-management',
    status: 'ok',
    durationMs: 96,
    attempts: 1,
    httpStatus: 200,
    startedAt: '2026-08-08T09:14:02.240Z',
    request: { asset_id: 'AST-1042' },
    response: {
      asset_id: 'AST-1042',
      criticality: 'high',
      nameplate: { manufacturer: 'Sulzer', rated_flow_m3h: 420, installed: '2014-06-01' },
      related_assets: [
        { asset_id: 'AST-1043', name: 'BFP 101 Suction Strainer', relation: 'upstream' },
        { asset_id: 'AST-1044', name: 'BFP 101 Drive Motor', relation: 'child' },
        { asset_id: 'AST-1010', name: 'Deaerator 1', relation: 'upstream' },
      ],
    },
  },
  {
    id: 'tc-3',
    index: 3,
    toolName: 'summarize_alarms',
    serverId: 'alarm-management',
    status: 'ok',
    durationMs: 412,
    attempts: 1,
    httpStatus: 200,
    startedAt: '2026-08-08T09:14:02.344Z',
    request: {
      asset_ids: ['AST-1042'],
      time_range: { start_time: '2026-05-10T00:00:00Z', end_time: '2026-08-08T00:00:00Z' },
      severity: ['high', 'critical'],
      group_by: ['alarm_name'],
      kpis: ['alarm_count', 'recurring_rate', 'avg_ack_delay'],
    },
    response: {
      groups: [
        { alarm_name: 'Suction Pressure Low', alarm_count: 23, severity: 'high' },
        { alarm_name: 'Bearing Temperature High', alarm_count: 14, severity: 'high' },
        { alarm_name: 'Discharge Flow Deviation', alarm_count: 7, severity: 'medium' },
        { alarm_name: 'Seal Leak Detected', alarm_count: 3, severity: 'critical' },
      ],
      kpis: { alarm_count: 47, recurring_rate: 0.68, avg_ack_delay: 11.4 },
    },
  },
  {
    id: 'tc-4',
    index: 4,
    toolName: 'correlate_alarms',
    serverId: 'alarm-management',
    status: 'ok',
    durationMs: 1284,
    attempts: 2,
    httpStatus: 200,
    startedAt: '2026-08-08T09:14:02.760Z',
    request: {
      asset_ids: ['AST-1042', 'AST-1043', 'AST-1044'],
      time_range: { start_time: '2026-05-10T00:00:00Z', end_time: '2026-08-08T00:00:00Z' },
      correlation_method: 'cooccurrence',
      lag_window_minutes: 20,
      min_support: 3,
    },
    response: {
      pairs: [
        {
          a: 'Suction Pressure Low',
          b: 'Bearing Temperature High',
          support: 14,
          lift: 3.1,
          median_lag_minutes: 12,
        },
        { a: 'Suction Pressure Low', b: 'Strainer DP High', support: 11, lift: 2.7, median_lag_minutes: -4 },
      ],
    },
  },
  {
    id: 'tc-5',
    index: 5,
    toolName: 'score_alarm_priority',
    serverId: 'alarm-management',
    status: 'ok',
    durationMs: 174,
    attempts: 1,
    httpStatus: 200,
    startedAt: '2026-08-08T09:14:04.060Z',
    request: { alarm_id: 'ALM-88214' },
    response: {
      priority_score: 82,
      factors: [
        { name: 'asset_criticality', weight: 0.4, value: 0.9 },
        { name: 'severity', weight: 0.35, value: 0.75 },
        { name: 'recurrence', weight: 0.25, value: 0.88 },
      ],
    },
  },
  {
    id: 'tc-6',
    index: 6,
    toolName: 'recommend_operator_actions',
    serverId: 'alarm-management',
    status: 'ok',
    durationMs: 638,
    attempts: 1,
    httpStatus: 200,
    startedAt: '2026-08-08T09:14:04.240Z',
    request: { alarm_id: 'ALM-88214', include_related: true, include_historical_pattern: true },
    response: {
      actions: [
        { step: 1, text: 'Verify deaerator level against the low-low setpoint.' },
        { step: 2, text: 'Check suction strainer differential pressure.' },
        { step: 3, text: 'Trend bearing temperature for 30 minutes.' },
        { step: 4, text: 'Schedule inboard bearing inspection at next outage.' },
      ],
      confidence: 0.76,
    },
  },
]

const CITATIONS: Citation[] = [
  {
    ref: 1,
    documentId: 'SOP-114',
    title: 'SOP-114 — Boiler Feed Pump Low Suction Pressure Response',
    kind: 'operating-procedure',
    locator: '§3.2, p.5',
    snippet:
      'Confirm deaerator level is above the 60% low-low setpoint and verify suction strainer differential pressure is below 0.4 bar before reducing pump demand.',
    score: 0.89,
    chunkId: 'SOP-114#c012',
  },
  {
    ref: 2,
    documentId: 'TG-051',
    title: 'TG-051 — Cavitation and NPSH Troubleshooting Guide',
    kind: 'troubleshooting-guide',
    locator: '§2.4, p.9',
    snippet:
      'Repeating low suction pressure events accompanied by rising bearing temperature within 10–20 minutes are characteristic of intermittent cavitation.',
    score: 0.84,
    chunkId: 'TG-051#c007',
  },
  {
    ref: 3,
    documentId: 'MM-207',
    title: 'MM-207 — Centrifugal Pump Maintenance Manual',
    kind: 'maintenance-manual',
    locator: '§7.3, p.47',
    snippet:
      'Where recurring suction transients are recorded, inspect the inboard bearing and mechanical seal faces at the next available outage rather than deferring to the annual interval.',
    score: 0.77,
    chunkId: 'MM-207#c188',
  },
  {
    ref: 4,
    documentId: 'SI-009',
    title: 'SI-009 — Safety Instruction: Isolation of Rotating Equipment',
    kind: 'safety-instruction',
    locator: '§1.2, p.2',
    snippet:
      'No physical inspection of pump internals may commence until the drive is isolated, locked and tagged, and stored energy is dissipated.',
    score: 0.71,
    chunkId: 'SI-009#c003',
  },
]

const CAUSES: LikelyCause[] = [
  {
    id: 'c1',
    title: 'Intermittent cavitation driven by suction-side restriction',
    description:
      'Suction Pressure Low leads Bearing Temperature High by a median of 12 minutes across 14 co-occurrences, and Strainer DP High precedes the suction event by 4 minutes. That ordering matches the cavitation signature described in the troubleshooting guide.',
    confidence: 0.81,
    evidence: ['correlate_alarms: lift 3.1, support 14', 'summarize_alarms: recurring_rate 0.68'],
    citationRefs: [2],
  },
  {
    id: 'c2',
    title: 'Suction strainer fouling not cleared between events',
    description:
      'Strainer DP High recurs 11 times without a corresponding changeover record, suggesting the restriction is being ridden through rather than resolved.',
    confidence: 0.64,
    evidence: ['correlate_alarms: Strainer DP High, support 11'],
    citationRefs: [1],
  },
  {
    id: 'c3',
    title: 'Progressive inboard bearing wear as a consequence, not a cause',
    description:
      'Bearing Temperature High consistently trails the suction event rather than leading it, so the bearing signal is most likely a downstream effect of repeated cavitation cycles.',
    confidence: 0.52,
    evidence: ['correlate_alarms: median_lag_minutes +12'],
    citationRefs: [3],
  },
]

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'r1',
    step: 1,
    text: 'Verify deaerator level against the 60% low-low setpoint before any demand reduction.',
    origin: 'both',
    citationRefs: [1],
    agreement: 'match',
  },
  {
    id: 'r2',
    step: 2,
    text: 'Check suction strainer differential pressure; initiate changeover if it exceeds 0.4 bar.',
    origin: 'both',
    citationRefs: [1],
    agreement: 'match',
  },
  {
    id: 'r3',
    step: 3,
    text: 'Recalculate available NPSH against the pump curve at current duty before scheduling mechanical work.',
    origin: 'document',
    citationRefs: [2],
    agreement: 'doc-only',
  },
  {
    id: 'r4',
    step: 4,
    text: 'Trend bearing temperature for 30 minutes to confirm it settles once suction pressure recovers.',
    origin: 'api',
    citationRefs: [],
    agreement: 'api-only',
  },
  {
    id: 'r5',
    step: 5,
    text: 'Raise an inboard bearing and seal-face inspection for the next outage. Note the API advises inspection at the next outage while MM-207 permits deferral only if no recurring suction transients are recorded — the recorded transients make deferral non-compliant.',
    origin: 'both',
    citationRefs: [3, 4],
    agreement: 'conflict',
  },
]

export const SAMPLE_ANSWER: AnswerBlock = {
  headline:
    'Boiler Feed Pump 101 shows a recurring suction-side restriction pattern, not an independent bearing fault.',
  paragraphs: [
    'Over the last 90 days Boiler Feed Pump 101 raised 47 high or critical alarms across four distinct alarm names, with a recurrence rate of 0.68 and a mean acknowledgement delay of 11.4 minutes.',
    'Correlation across the pump, its suction strainer and its drive motor shows Suction Pressure Low leading Bearing Temperature High by a median of 12 minutes (lift 3.1, support 14), while Strainer DP High precedes the suction event by 4 minutes. Read together with the cavitation signature in TG-051 [2], the evidence points to a suction-side restriction rather than a primary bearing failure.',
    'The source system’s recommended actions align with SOP-114 [1] on the first two steps. They diverge on inspection timing, which is flagged below.',
  ],
  summary: {
    assetId: 'AST-1042',
    assetName: 'Boiler Feed Pump 101',
    site: 'NorthPlant',
    unit: 'Unit 1',
    windowLabel: 'Last 90 days · 10 May – 08 Aug 2026',
    totalAlarms: 47,
    activeAlarms: 3,
    bySeverity: { critical: 3, high: 37, medium: 7, low: 0 },
    topAlarmName: 'Suction Pressure Low',
    recurringRate: 0.68,
    avgAckDelayMin: 11.4,
    priorityScore: 82,
  },
  causes: CAUSES,
  recommendations: RECOMMENDATIONS,
  citations: CITATIONS,
  toolCalls: TOOL_CALLS,
}

/* A degraded variant — required demo evidence is "one failure or degraded
   scenario". Correlation times out; the answer is still produced but scoped. */
export const DEGRADED_ANSWER: AnswerBlock = {
  ...SAMPLE_ANSWER,
  headline: 'Partial result: alarm history retrieved, correlation unavailable.',
  paragraphs: [
    'Alarm history and asset context for Boiler Feed Pump 101 were retrieved successfully. The correlation tool exceeded its 15-second budget after two attempts, so cause ranking below is based on frequency and document evidence only.',
    'Treat the ordering as provisional. Re-run once the correlation service recovers to confirm the lead/lag relationship between the suction and bearing alarms.',
  ],
  causes: CAUSES.slice(0, 2).map((c) => ({ ...c, confidence: c.confidence * 0.6 })),
  degraded: {
    reason: 'correlate_alarms exceeded its 15s timeout after 2 attempts (UPSTREAM_TIMEOUT).',
    failedTools: ['correlate_alarms'],
  },
  toolCalls: [
    ...TOOL_CALLS.slice(0, 3),
    {
      id: 'tc-4e',
      index: 4,
      toolName: 'correlate_alarms',
      serverId: 'alarm-management',
      status: 'error',
      durationMs: 15002,
      attempts: 3,
      httpStatus: 504,
      startedAt: '2026-08-08T09:22:11.400Z',
      request: {
        asset_ids: ['AST-1042', 'AST-1043', 'AST-1044'],
        time_range: { start_time: '2026-05-10T00:00:00Z', end_time: '2026-08-08T00:00:00Z' },
        correlation_method: 'cooccurrence',
      },
      response: null,
      error: {
        code: 'UPSTREAM_TIMEOUT',
        message: 'Alarm API did not respond within 15000ms. Retried 2 times with exponential backoff.',
      },
    },
    { ...TOOL_CALLS[5], index: 5, id: 'tc-6d' },
  ],
}

/* A low-confidence retrieval variant. */
export const LOW_CONFIDENCE_ANSWER: AnswerBlock = {
  ...SAMPLE_ANSWER,
  headline: 'Alarm data retrieved, but no procedure in the corpus matches this alarm closely enough to cite.',
  paragraphs: [
    'The alarm history and correlation results below are reliable. However, the highest-scoring document passage reached only 0.34 against a retrieval floor of 0.55, so no procedural guidance is being asserted.',
    'The corpus currently holds no operating procedure covering this alarm type. Recommendations shown come from the source system alone and have not been cross-checked against site documentation.',
  ],
  recommendations: RECOMMENDATIONS.filter((r) => r.origin === 'api'),
  citations: [],
  lowConfidence: {
    reason: 'No retrieved chunk met the similarity floor for grounded procedural guidance.',
    topScore: 0.34,
    floor: 0.55,
  },
}

export const INITIAL_MESSAGES: ChatMessage[] = []

export const SAMPLE_THREAD: ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    createdAt: '2026-08-08T09:14:01.900Z',
    text: 'Investigate recurring high-severity alarms for Boiler Feed Pump 101 over the last 90 days',
    state: 'complete',
  },
  {
    id: 'm2',
    role: 'assistant',
    createdAt: '2026-08-08T09:14:05.100Z',
    answer: SAMPLE_ANSWER,
    state: 'complete',
  },
]

/* --- Observability ---------------------------------------------------- */

export const TRACES: TraceRecord[] = [
  {
    traceId: 'trace-8f2a41c9',
    requestId: 'req-01J9X4',
    conversationId: 'conv-4471',
    question: 'Investigate recurring high-severity alarms for Boiler Feed Pump 101 over the last 90 days',
    startedAt: '2026-08-08T09:14:02.114Z',
    totalMs: 3186,
    llmMs: 1420,
    retrievalMs: 208,
    toolCount: 6,
    retryCount: 1,
    retrievedDocs: 4,
    topScore: 0.89,
    outcome: 'success',
    calls: TOOL_CALLS,
  },
  {
    traceId: 'trace-2b71d004',
    requestId: 'req-01J9X3',
    conversationId: 'conv-4470',
    question: 'Which alarm has the highest priority in EastRefinery, and why?',
    startedAt: '2026-08-08T08:51:44.010Z',
    totalMs: 2214,
    llmMs: 1105,
    retrievalMs: 181,
    toolCount: 4,
    retryCount: 0,
    retrievedDocs: 2,
    topScore: 0.72,
    outcome: 'success',
    calls: TOOL_CALLS.slice(0, 4),
  },
  {
    traceId: 'trace-c90e7752',
    requestId: 'req-01J9X2',
    conversationId: 'conv-4469',
    question: 'Why are compressor discharge pressure alarms repeatedly occurring?',
    startedAt: '2026-08-08T08:33:19.882Z',
    totalMs: 17440,
    llmMs: 1290,
    retrievalMs: 240,
    toolCount: 5,
    retryCount: 2,
    retrievedDocs: 3,
    topScore: 0.66,
    outcome: 'degraded',
    calls: DEGRADED_ANSWER.toolCalls,
  },
  {
    traceId: 'trace-51aa9e30',
    requestId: 'req-01J9X1',
    conversationId: 'conv-4468',
    question: 'What related assets should be inspected for this motor trip alarm?',
    startedAt: '2026-08-08T08:12:07.455Z',
    totalMs: 980,
    llmMs: 0,
    retrievalMs: 0,
    toolCount: 1,
    retryCount: 3,
    retrievedDocs: 0,
    topScore: 0,
    outcome: 'failed',
    calls: [
      {
        id: 'tc-f1',
        index: 1,
        toolName: 'search_assets',
        serverId: 'alarm-management',
        status: 'error',
        durationMs: 980,
        attempts: 3,
        httpStatus: 503,
        startedAt: '2026-08-08T08:12:07.455Z',
        request: { query: 'motor', unit: 'Unit 5', limit: 5 },
        response: null,
        error: { code: 'UPSTREAM_ERROR', message: 'Alarm API returned 503 Service Unavailable after 3 attempts.' },
      },
    ],
  },
]

/* --- Configuration ---------------------------------------------------- */

export const ENV_SETTINGS: EnvSetting[] = [
  {
    key: 'ALARM_API_BASE_URL',
    value: 'http://alarm-api:8000',
    secret: false,
    description: 'Base URL of the Alarm Management API simulator.',
    source: 'env',
  },
  {
    key: 'ALARM_API_TOKEN',
    value: 'demo-token',
    secret: true,
    description: 'Bearer token presented by the MCP server to the Alarm API.',
    source: 'env',
  },
  {
    key: 'MCP_SERVER_URL',
    value: 'http://alarm-mcp:9000/mcp',
    secret: false,
    description: 'Endpoint the copilot connects to for tool discovery.',
    source: 'env',
  },
  {
    key: 'LLM_PROVIDER',
    value: 'anthropic',
    secret: false,
    description: 'Active LLM provider adapter.',
    source: 'env',
  },
  {
    key: 'LLM_MODEL',
    value: 'claude-sonnet-5',
    secret: false,
    description: 'Model identifier used for planning and answer synthesis.',
    source: 'env',
  },
  {
    key: 'LLM_API_KEY',
    value: 'sk-ant-api03-••••••••••••••••',
    secret: true,
    description: 'Provider credential. Never logged or returned to the browser.',
    source: 'env',
  },
  {
    key: 'VECTOR_STORE_URL',
    value: 'http://qdrant:6333',
    secret: false,
    description: 'Retrieval index endpoint.',
    source: 'env',
  },
  {
    key: 'DOCUMENT_PATH',
    value: './rag/documents',
    secret: false,
    description: 'Source corpus directory scanned by the ingestion pipeline.',
    source: 'default',
  },
  {
    key: 'RETRIEVAL_SCORE_FLOOR',
    value: '0.55',
    secret: false,
    description: 'Minimum similarity for a chunk to be cited. Below this the answer degrades to low-confidence.',
    source: 'default',
  },
  {
    key: 'MCP_TOOL_TIMEOUT_MS',
    value: '15000',
    secret: false,
    description: 'Default per-tool timeout before the orchestrator gives up.',
    source: 'default',
  },
  {
    key: 'TICKETING_API_URL',
    value: 'http://ticketing:8080',
    secret: false,
    description: 'Optional secondary source system for maintenance write-back.',
    source: 'env',
  },
]

export const HEALTH_CHECKS: HealthCheck[] = [
  {
    id: 'alarm-api',
    name: 'Alarm Management API',
    url: 'http://alarm-api:8000/health',
    status: 'ok',
    latencyMs: 12,
    detail: '15 endpoints registered · seed data loaded',
  },
  {
    id: 'alarm-mcp',
    name: 'Alarm MCP Server',
    url: 'http://alarm-mcp:9000/mcp',
    status: 'ok',
    latencyMs: 18,
    detail: '12 tools discovered · protocol 2025-06-18',
  },
  {
    id: 'backend',
    name: 'Copilot Backend',
    url: 'http://backend:8100/health',
    status: 'ok',
    latencyMs: 8,
    detail: 'Orchestrator ready',
  },
  {
    id: 'vector',
    name: 'Vector Store',
    url: 'http://qdrant:6333/healthz',
    status: 'ok',
    latencyMs: 21,
    detail: '696 chunks indexed across 5 documents',
  },
  {
    id: 'llm',
    name: 'LLM Provider',
    url: 'anthropic · claude-sonnet-5',
    status: 'ok',
    latencyMs: 640,
    detail: 'Last call 1.42s',
  },
  {
    id: 'ticketing',
    name: 'Ticketing MCP Server',
    url: 'http://ticketing-mcp:9010/mcp',
    status: 'degraded',
    latencyMs: 412,
    detail: 'Elevated latency · write tools require confirmation',
  },
]
