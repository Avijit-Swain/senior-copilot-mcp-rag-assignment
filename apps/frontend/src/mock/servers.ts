import type { McpServerInfo, McpTool } from '../lib/types'

/* --------------------------------------------------------------------------
   Placeholder MCP server + tool catalog.

   Shapes match `docs/mcp-tool-catalog.md`. Replaced by a live `tools/list`
   response once the MCP client is wired in.
   -------------------------------------------------------------------------- */

export const MCP_SERVERS: McpServerInfo[] = [
  {
    id: 'alarm-management',
    name: 'Alarm Management',
    transport: 'streamable-http',
    url: 'http://alarm-mcp:9000/mcp',
    status: 'ok',
    protocolVersion: '2025-06-18',
    toolCount: 12,
    latencyMs: 18,
  },
  {
    id: 'ticketing',
    name: 'Maintenance Ticketing',
    transport: 'streamable-http',
    url: 'http://ticketing-mcp:9010/mcp',
    status: 'degraded',
    protocolVersion: '2025-06-18',
    toolCount: 2,
    latencyMs: 412,
  },
]

const alarmTool = (
  t: Omit<McpTool, 'serverId' | 'authScope'> & Partial<Pick<McpTool, 'authScope'>>,
): McpTool => ({ serverId: 'alarm-management', authScope: 'alarm:read', ...t })

export const MCP_TOOLS: McpTool[] = [
  alarmTool({
    name: 'search_assets',
    title: 'Search assets',
    description:
      'Resolve a free-text asset name, tag or keyword to one or more asset identifiers. Usually the first call in an investigation.',
    operation: 'GET /assets/search',
    timeoutMs: 5000,
    retries: 2,
    input: [
      { name: 'query', type: 'string', required: true, description: 'Free-text asset name or tag fragment.' },
      { name: 'site', type: 'string', required: false, description: 'Restrict results to a site, e.g. EastRefinery.' },
      { name: 'unit', type: 'string', required: false, description: 'Restrict results to a unit, e.g. Unit 5.' },
      { name: 'limit', type: 'integer (1-50)', required: false, description: 'Maximum results. Defaults to 10.' },
    ],
    output: [
      { name: 'results[].asset_id', type: 'string', required: true, description: 'Stable asset identifier.' },
      { name: 'results[].name', type: 'string', required: true, description: 'Display name.' },
      { name: 'results[].type', type: 'string', required: true, description: 'Asset class, e.g. pump.' },
      { name: 'results[].site', type: 'string', required: true, description: 'Owning site.' },
      { name: 'match_score', type: 'number', required: false, description: 'Relevance of the top match.' },
    ],
    errorCodes: [
      { code: 'INVALID_ARGUMENT', meaning: 'query is empty or limit is out of range.' },
      { code: 'UPSTREAM_TIMEOUT', meaning: 'Alarm API did not respond within 5s after 2 retries.' },
    ],
    exampleInput: { query: 'Boiler Feed Pump 101', limit: 5 },
    exampleOutput: {
      results: [
        { asset_id: 'AST-1042', name: 'Boiler Feed Pump 101', type: 'pump', site: 'NorthPlant', unit: 'Unit 1' },
      ],
      match_score: 0.98,
    },
  }),
  alarmTool({
    name: 'get_asset_metadata',
    title: 'Get asset metadata',
    description:
      'Fetch nameplate data, criticality, parent/child hierarchy and related assets for a resolved asset identifier.',
    operation: 'GET /assets/{asset_id}/metadata',
    timeoutMs: 5000,
    retries: 2,
    input: [{ name: 'asset_id', type: 'string', required: true, description: 'Identifier from search_assets.' }],
    output: [
      { name: 'asset_id', type: 'string', required: true, description: 'Echoed identifier.' },
      { name: 'criticality', type: 'enum', required: true, description: 'low | medium | high | critical.' },
      { name: 'related_assets[]', type: 'object[]', required: true, description: 'Upstream/downstream neighbours.' },
      { name: 'nameplate', type: 'object', required: false, description: 'Rated duty, manufacturer, install date.' },
    ],
    errorCodes: [
      { code: 'NOT_FOUND', meaning: 'No asset exists with that identifier.' },
      { code: 'INVALID_ARGUMENT', meaning: 'asset_id failed the identifier pattern check.' },
    ],
    exampleInput: { asset_id: 'AST-1042' },
    exampleOutput: {
      asset_id: 'AST-1042',
      criticality: 'high',
      related_assets: [{ asset_id: 'AST-1043', name: 'BFP 101 Suction Strainer', relation: 'upstream' }],
    },
  }),
  alarmTool({
    name: 'get_alarms',
    title: 'List alarms',
    description:
      'Page through alarms filtered by asset, site, unit, status, severity and time window. Supports server-side sorting.',
    operation: 'GET /alarms',
    timeoutMs: 8000,
    retries: 2,
    input: [
      { name: 'asset_id', type: 'string', required: false, description: 'Filter to one asset.' },
      { name: 'site', type: 'string', required: false, description: 'Filter to one site.' },
      { name: 'status', type: 'enum', required: false, description: 'active | acknowledged | cleared.' },
      { name: 'start_time', type: 'ISO-8601', required: false, description: 'Window start, inclusive.' },
      { name: 'end_time', type: 'ISO-8601', required: false, description: 'Window end, exclusive.' },
      { name: 'page', type: 'integer', required: false, description: '1-based page number.' },
      { name: 'page_size', type: 'integer (1-200)', required: false, description: 'Rows per page.' },
    ],
    output: [
      { name: 'data[]', type: 'object[]', required: true, description: 'Alarm records.' },
      { name: 'page', type: 'integer', required: true, description: 'Current page.' },
      { name: 'total', type: 'integer', required: true, description: 'Total matching rows.' },
      { name: 'has_more', type: 'boolean', required: true, description: 'Whether another page exists.' },
    ],
    errorCodes: [
      { code: 'INVALID_ARGUMENT', meaning: 'page_size above 200, or end_time before start_time.' },
      { code: 'UPSTREAM_ERROR', meaning: 'Alarm API returned 5xx after retries.' },
    ],
    exampleInput: { asset_id: 'AST-1042', status: 'active', page: 1, page_size: 50 },
    exampleOutput: { data: [{ alarm_id: 'ALM-88214', severity: 'high' }], page: 1, total: 47, has_more: false },
  }),
  alarmTool({
    name: 'get_alarm_detail',
    title: 'Get alarm detail',
    description: 'Retrieve the full record for a single alarm including acknowledgement and clearance history.',
    operation: 'GET /alarms/{alarm_id}',
    timeoutMs: 5000,
    retries: 2,
    input: [{ name: 'alarm_id', type: 'string', required: true, description: 'Identifier from get_alarms.' }],
    output: [
      { name: 'alarm_id', type: 'string', required: true, description: 'Echoed identifier.' },
      { name: 'severity', type: 'enum', required: true, description: 'low | medium | high | critical.' },
      { name: 'history[]', type: 'object[]', required: false, description: 'State transitions with timestamps.' },
    ],
    errorCodes: [{ code: 'NOT_FOUND', meaning: 'No alarm exists with that identifier.' }],
    exampleInput: { alarm_id: 'ALM-88214' },
    exampleOutput: { alarm_id: 'ALM-88214', severity: 'high', alarm_name: 'Suction Pressure Low' },
  }),
  alarmTool({
    name: 'summarize_alarms',
    title: 'Summarise alarms',
    description:
      'Aggregate alarms over a time window with configurable grouping and KPIs such as recurrence rate and acknowledgement delay.',
    operation: 'POST /alarms/summary',
    timeoutMs: 10000,
    retries: 1,
    input: [
      { name: 'asset_ids', type: 'string[]', required: false, description: 'Assets to include.' },
      { name: 'time_range', type: 'object', required: true, description: '{ start_time, end_time } in ISO-8601.' },
      { name: 'severity', type: 'enum[]', required: false, description: 'Severities to include.' },
      { name: 'group_by', type: 'enum[]', required: false, description: 'alarm_name | asset_id | severity.' },
      { name: 'kpis', type: 'enum[]', required: false, description: 'alarm_count | recurring_rate | avg_ack_delay.' },
    ],
    output: [
      { name: 'groups[]', type: 'object[]', required: true, description: 'One row per grouping key.' },
      { name: 'kpis', type: 'object', required: true, description: 'Computed KPI values for the window.' },
    ],
    errorCodes: [
      { code: 'INVALID_ARGUMENT', meaning: 'Unknown group_by or kpi value.' },
      { code: 'WINDOW_TOO_LARGE', meaning: 'Requested range exceeds the 365-day cap.' },
    ],
    exampleInput: {
      asset_ids: ['AST-1042'],
      time_range: { start_time: '2026-05-10T00:00:00Z', end_time: '2026-08-08T00:00:00Z' },
      kpis: ['alarm_count', 'recurring_rate'],
    },
    exampleOutput: { groups: [{ alarm_name: 'Suction Pressure Low', alarm_count: 23 }], kpis: { alarm_count: 47 } },
  }),
  alarmTool({
    name: 'get_alarm_trends',
    title: 'Get alarm trends',
    description: 'Bucket alarm counts and response metrics over time to expose escalation or drift.',
    operation: 'POST /alarms/trends',
    timeoutMs: 10000,
    retries: 1,
    input: [
      { name: 'asset_ids', type: 'string[]', required: false, description: 'Assets to include.' },
      { name: 'time_range', type: 'object', required: true, description: '{ start_time, end_time }.' },
      { name: 'bucket', type: 'enum', required: true, description: 'hourly | daily | weekly.' },
      { name: 'metrics', type: 'enum[]', required: true, description: 'alarm_count | avg_ack_delay.' },
    ],
    output: [{ name: 'series[]', type: 'object[]', required: true, description: 'Bucketed data points.' }],
    errorCodes: [{ code: 'INVALID_ARGUMENT', meaning: 'Unsupported bucket size for the requested range.' }],
    exampleInput: { asset_ids: ['AST-1042'], bucket: 'weekly', metrics: ['alarm_count'] },
    exampleOutput: { series: [{ bucket_start: '2026-07-27T00:00:00Z', alarm_count: 9 }] },
  }),
  alarmTool({
    name: 'correlate_alarms',
    title: 'Correlate alarms',
    description:
      'Find alarms that co-occur within a lag window across one or more assets, used to separate root cause from consequence.',
    operation: 'POST /alarms/correlation',
    timeoutMs: 15000,
    retries: 1,
    input: [
      { name: 'asset_ids', type: 'string[]', required: true, description: 'Assets to correlate across.' },
      { name: 'time_range', type: 'object', required: true, description: '{ start_time, end_time }.' },
      { name: 'correlation_method', type: 'enum', required: false, description: 'cooccurrence | sequence.' },
      { name: 'lag_window_minutes', type: 'integer', required: false, description: 'Pairing window. Defaults to 15.' },
      { name: 'min_support', type: 'integer', required: false, description: 'Minimum co-occurrence count.' },
    ],
    output: [
      { name: 'pairs[]', type: 'object[]', required: true, description: 'Correlated alarm pairs with support and lift.' },
    ],
    errorCodes: [
      { code: 'INVALID_ARGUMENT', meaning: 'asset_ids empty or lag_window_minutes negative.' },
      { code: 'UPSTREAM_TIMEOUT', meaning: 'Correlation exceeded the 15s budget.' },
    ],
    exampleInput: { asset_ids: ['AST-1042', 'AST-1043'], correlation_method: 'cooccurrence', min_support: 3 },
    exampleOutput: { pairs: [{ a: 'Suction Pressure Low', b: 'Bearing Temp High', support: 14, lift: 3.1 }] },
  }),
  alarmTool({
    name: 'score_alarm_priority',
    title: 'Score alarm priority',
    description: 'Compute a composite priority score for an alarm from severity, asset criticality and recurrence.',
    operation: 'POST /alarms/priority-score',
    timeoutMs: 8000,
    retries: 1,
    input: [{ name: 'alarm_id', type: 'string', required: true, description: 'Alarm to score.' }],
    output: [
      { name: 'priority_score', type: 'number (0-100)', required: true, description: 'Composite score.' },
      { name: 'factors[]', type: 'object[]', required: true, description: 'Contributing factors and weights.' },
    ],
    errorCodes: [{ code: 'NOT_FOUND', meaning: 'Alarm identifier not recognised.' }],
    exampleInput: { alarm_id: 'ALM-88214' },
    exampleOutput: { priority_score: 82, factors: [{ name: 'asset_criticality', weight: 0.4, value: 0.9 }] },
  }),
  alarmTool({
    name: 'recommend_operator_actions',
    title: 'Recommend operator actions',
    description:
      'Return the source system’s recommended response steps for an alarm, optionally enriched with related-asset and historical context.',
    operation: 'POST /recommendations/operator-actions',
    timeoutMs: 12000,
    retries: 1,
    input: [
      { name: 'alarm_id', type: 'string', required: true, description: 'Alarm to advise on.' },
      { name: 'include_related', type: 'boolean', required: false, description: 'Include related-asset actions.' },
      { name: 'include_asset_context', type: 'boolean', required: false, description: 'Include nameplate context.' },
      {
        name: 'include_historical_pattern',
        type: 'boolean',
        required: false,
        description: 'Include prior-occurrence patterns.',
      },
    ],
    output: [
      { name: 'actions[]', type: 'object[]', required: true, description: 'Ordered recommended steps.' },
      { name: 'confidence', type: 'number', required: false, description: 'Source-system confidence.' },
    ],
    errorCodes: [
      { code: 'NOT_FOUND', meaning: 'Alarm identifier not recognised.' },
      { code: 'UPSTREAM_ERROR', meaning: 'Recommendation engine unavailable.' },
    ],
    exampleInput: { alarm_id: 'ALM-88214', include_related: true },
    exampleOutput: { actions: [{ step: 1, text: 'Verify suction strainer differential pressure.' }], confidence: 0.76 },
  }),
  alarmTool({
    name: 'analyze_alarm_flood',
    title: 'Analyse alarm floods',
    description: 'Detect rolling windows where alarm rate exceeded the configured operator-load threshold.',
    operation: 'POST /alarms/flood-analysis',
    timeoutMs: 15000,
    retries: 1,
    input: [
      { name: 'unit', type: 'string', required: false, description: 'Unit to analyse.' },
      { name: 'time_range', type: 'object', required: true, description: '{ start_time, end_time }.' },
      { name: 'threshold_count', type: 'integer', required: false, description: 'Alarms per window. Defaults to 10.' },
      { name: 'rolling_window_minutes', type: 'integer', required: false, description: 'Window size in minutes.' },
    ],
    output: [{ name: 'flood_windows[]', type: 'object[]', required: true, description: 'Detected flood windows.' }],
    errorCodes: [{ code: 'INVALID_ARGUMENT', meaning: 'threshold_count below 1.' }],
    exampleInput: { unit: 'Unit 2', threshold_count: 10, rolling_window_minutes: 10 },
    exampleOutput: { flood_windows: [{ start: '2026-06-14T02:10:00Z', end: '2026-06-14T02:20:00Z', count: 31 }] },
  }),
  alarmTool({
    name: 'find_rationalization_candidates',
    title: 'Find rationalisation candidates',
    description: 'Identify nuisance, chattering or stale alarms that are candidates for rationalisation.',
    operation: 'POST /alarms/rationalization-candidates',
    timeoutMs: 15000,
    retries: 1,
    input: [
      { name: 'asset_ids', type: 'string[]', required: false, description: 'Assets to evaluate.' },
      { name: 'time_range', type: 'object', required: true, description: '{ start_time, end_time }.' },
      { name: 'recurrence_threshold', type: 'integer', required: false, description: 'Occurrences before flagging.' },
      { name: 'stale_minutes_threshold', type: 'integer', required: false, description: 'Standing-alarm cut-off.' },
    ],
    output: [{ name: 'candidates[]', type: 'object[]', required: true, description: 'Flagged alarms with reasons.' }],
    errorCodes: [{ code: 'INVALID_ARGUMENT', meaning: 'recurrence_threshold below 1.' }],
    exampleInput: { asset_ids: ['AST-1042'], recurrence_threshold: 5 },
    exampleOutput: { candidates: [{ alarm_name: 'Suction Pressure Low', reason: 'chattering', occurrences: 23 }] },
  }),
  alarmTool({
    name: 'list_kpi_definitions',
    title: 'List KPI definitions',
    description: 'Return the catalogue of supported KPI identifiers, formulae and units.',
    operation: 'GET /analytics/kpi-definitions',
    timeoutMs: 5000,
    retries: 2,
    input: [],
    output: [{ name: 'kpis[]', type: 'object[]', required: true, description: 'KPI id, description, unit, formula.' }],
    errorCodes: [{ code: 'UPSTREAM_ERROR', meaning: 'Alarm API unavailable.' }],
    exampleInput: {},
    exampleOutput: { kpis: [{ id: 'recurring_rate', unit: 'ratio', description: 'Repeat occurrences over total.' }] },
  }),
  {
    name: 'create_maintenance_ticket',
    serverId: 'ticketing',
    title: 'Create maintenance ticket',
    description:
      'Raise a maintenance work request. Write operation — the orchestrator must obtain explicit user confirmation before this tool is invoked.',
    operation: 'POST /tickets',
    timeoutMs: 10000,
    retries: 0,
    authScope: 'ticket:write',
    input: [
      { name: 'asset_id', type: 'string', required: true, description: 'Asset the ticket is raised against.' },
      { name: 'summary', type: 'string', required: true, description: 'Short problem statement.' },
      { name: 'priority', type: 'enum', required: true, description: 'low | medium | high | urgent.' },
      { name: 'confirmed', type: 'boolean', required: true, description: 'Must be true; set only after user approval.' },
    ],
    output: [
      { name: 'ticket_id', type: 'string', required: true, description: 'Created ticket identifier.' },
      { name: 'url', type: 'string', required: true, description: 'Deep link to the ticket.' },
    ],
    errorCodes: [
      { code: 'CONFIRMATION_REQUIRED', meaning: 'confirmed was false or absent — no ticket was created.' },
      { code: 'UPSTREAM_ERROR', meaning: 'Ticketing system rejected the request.' },
    ],
    exampleInput: { asset_id: 'AST-1042', summary: 'Recurring suction pressure low', priority: 'high', confirmed: true },
    exampleOutput: { ticket_id: 'WO-40218', url: 'https://cmms.example/wo/40218' },
  },
]
