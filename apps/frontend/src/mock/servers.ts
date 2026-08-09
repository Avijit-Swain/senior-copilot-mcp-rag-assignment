import type { McpServerInfo, McpTool } from '../lib/types'

export const MCP_SERVERS: McpServerInfo[] = [
  {
    id: 'alarm-management',
    name: 'Alarm Management',
    transport: 'stdio',
    url: '.venv/bin/python -m alarm_mcp.server',
    status: 'ok',
    protocolVersion: 'MCP stdio',
    toolCount: 7,
    latencyMs: null,
  },
]

const alarmTool = (tool: Omit<McpTool, 'serverId' | 'authScope'>): McpTool => ({
  serverId: 'alarm-management',
  authScope: 'alarm:read',
  ...tool,
})

export const MCP_TOOLS: McpTool[] = [
  alarmTool({
    name: 'search_assets',
    title: 'Search assets',
    description:
      'Resolve a free-text asset name, tag, type, site or unit to one or more Alarm Management asset IDs.',
    operation: 'GET /assets/search',
    timeoutMs: 15000,
    retries: 2,
    input: [
      { name: 'query', type: 'string', required: true, description: 'Free-text asset query, tag or asset type.' },
      { name: 'site', type: 'string', required: false, description: 'Optional site filter.' },
      { name: 'unit', type: 'string', required: false, description: 'Optional unit filter.' },
      { name: 'limit', type: 'integer (1-50)', required: false, description: 'Maximum results. Defaults to 10.' },
      { name: 'trace', type: 'TraceContext', required: false, description: 'trace_id, client_id and metadata_tag.' },
    ],
    output: [
      { name: 'ok', type: 'boolean', required: true, description: 'Whether the upstream call succeeded.' },
      { name: 'data.results[]', type: 'object[]', required: false, description: 'Matching assets.' },
      { name: 'trace', type: 'object', required: true, description: 'Method, URL, status, duration and attempts.' },
    ],
    errorCodes: [
      { code: 'alarm_api_error', meaning: 'Alarm API returned a non-2xx response.' },
      { code: 'timeout', meaning: 'Alarm API did not respond inside MCP_TOOL_TIMEOUT_MS.' },
      { code: 'transport_error', meaning: 'HTTP transport failed before a response was received.' },
    ],
    exampleInput: { query: 'Boiler Feed Pump 101', limit: 10 },
    exampleOutput: { ok: true, data: { results: [{ asset_id: 'BFP-101', asset_name: 'Boiler Feed Pump 101' }] } },
  }),
  alarmTool({
    name: 'get_asset_metadata',
    title: 'Get asset metadata',
    description: 'Fetch process context, criticality, nameplate metadata and related assets for a resolved asset ID.',
    operation: 'GET /assets/{asset_id}/metadata',
    timeoutMs: 15000,
    retries: 2,
    input: [
      { name: 'asset_id', type: 'string', required: true, description: 'Identifier returned by search_assets.' },
      { name: 'trace', type: 'TraceContext', required: false, description: 'trace_id, client_id and metadata_tag.' },
    ],
    output: [
      { name: 'ok', type: 'boolean', required: true, description: 'Whether the upstream call succeeded.' },
      { name: 'data.asset', type: 'object', required: false, description: 'Asset record and metadata.' },
      { name: 'data.related_assets[]', type: 'object[]', required: false, description: 'Related upstream/downstream assets.' },
      { name: 'trace', type: 'object', required: true, description: 'Method, URL, status, duration and attempts.' },
    ],
    errorCodes: [
      { code: 'alarm_api_error', meaning: 'The asset was not found or the API rejected the request.' },
      { code: 'timeout', meaning: 'Alarm API did not respond inside MCP_TOOL_TIMEOUT_MS.' },
    ],
    exampleInput: { asset_id: 'BFP-101' },
    exampleOutput: { ok: true, data: { asset: { asset_id: 'BFP-101', asset_name: 'Boiler Feed Pump 101' } } },
  }),
  alarmTool({
    name: 'get_alarms',
    title: 'Get alarms',
    description:
      'Retrieve active or historical alarms with asset, site, unit, status, time-window, pagination and sorting filters.',
    operation: 'GET /alarms',
    timeoutMs: 15000,
    retries: 2,
    input: [
      { name: 'asset_id', type: 'string', required: false, description: 'Filter to one asset.' },
      { name: 'site', type: 'string', required: false, description: 'Filter to one site.' },
      { name: 'unit', type: 'string', required: false, description: 'Filter to one unit.' },
      { name: 'status', type: 'string', required: false, description: 'Filter by active, acknowledged or cleared.' },
      { name: 'start_time', type: 'ISO-8601', required: false, description: 'Inclusive start time.' },
      { name: 'end_time', type: 'ISO-8601', required: false, description: 'Inclusive end time.' },
      { name: 'page', type: 'integer', required: false, description: '1-based page. Defaults to 1.' },
      { name: 'page_size', type: 'integer (1-100)', required: false, description: 'Rows per page. Defaults to 50.' },
      { name: 'trace', type: 'TraceContext', required: false, description: 'trace_id, client_id and metadata_tag.' },
    ],
    output: [
      { name: 'ok', type: 'boolean', required: true, description: 'Whether the upstream call succeeded.' },
      { name: 'data.data[]', type: 'object[]', required: false, description: 'Alarm rows.' },
      { name: 'data.pagination', type: 'object', required: false, description: 'Page, page_size, total and has_more.' },
      { name: 'trace', type: 'object', required: true, description: 'Method, URL, status, duration and attempts.' },
    ],
    errorCodes: [
      { code: 'alarm_api_error', meaning: 'Alarm API returned an invalid argument or source-system error.' },
      { code: 'timeout', meaning: 'Alarm API did not respond inside MCP_TOOL_TIMEOUT_MS.' },
    ],
    exampleInput: { asset_id: 'BFP-101', page: 1, page_size: 50 },
    exampleOutput: { ok: true, data: { data: [{ alarm_id: 'ALM-BFP101-DP-HH', severity: 'critical' }] } },
  }),
  alarmTool({
    name: 'get_alarm_summary',
    title: 'Get alarm summary',
    description:
      'Calculate alarm summary KPIs such as alarm count, recurrence rate and average acknowledgement delay.',
    operation: 'POST /alarms/summary',
    timeoutMs: 15000,
    retries: 2,
    input: [
      { name: 'asset_ids', type: 'string[]', required: false, description: 'Assets to include.' },
      { name: 'time_range', type: 'TimeRange', required: false, description: 'start_time and end_time.' },
      { name: 'severity', type: 'enum[]', required: false, description: 'medium, high or critical.' },
      { name: 'group_by', type: 'string[]', required: false, description: 'Grouping fields. Defaults to alarm_name.' },
      { name: 'kpis', type: 'string[]', required: false, description: 'alarm_count, recurring_rate, avg_ack_delay.' },
      { name: 'trace', type: 'TraceContext', required: false, description: 'trace_id, client_id and metadata_tag.' },
    ],
    output: [
      { name: 'ok', type: 'boolean', required: true, description: 'Whether the upstream call succeeded.' },
      { name: 'data.total_alarms', type: 'integer', required: false, description: 'Total alarms in the filtered window.' },
      { name: 'data.groups[]', type: 'object[]', required: false, description: 'Grouped KPI rows.' },
      { name: 'trace', type: 'object', required: true, description: 'Method, URL, status, duration and attempts.' },
    ],
    errorCodes: [
      { code: 'alarm_api_error', meaning: 'Unsupported filters or source-system error.' },
      { code: 'timeout', meaning: 'Alarm API did not respond inside MCP_TOOL_TIMEOUT_MS.' },
    ],
    exampleInput: {
      asset_ids: ['BFP-101'],
      time_range: { start_time: '2026-05-01T00:00:00Z', end_time: '2026-07-31T23:59:59Z' },
    },
    exampleOutput: { ok: true, data: { total_alarms: 4, groups: [{ alarm_name: 'Discharge Pressure High High' }] } },
  }),
  alarmTool({
    name: 'correlate_alarms',
    title: 'Correlate alarms',
    description: 'Find correlated alarm patterns for one or more assets over a time window.',
    operation: 'POST /alarms/correlation',
    timeoutMs: 15000,
    retries: 2,
    input: [
      { name: 'asset_ids', type: 'string[]', required: true, description: 'One or more assets to correlate.' },
      { name: 'time_range', type: 'TimeRange', required: false, description: 'start_time and end_time.' },
      { name: 'correlation_method', type: 'string', required: false, description: 'Defaults to cooccurrence.' },
      { name: 'lag_window_minutes', type: 'integer (1-1440)', required: false, description: 'Lag window. Defaults to 15.' },
      { name: 'severity_threshold', type: 'enum', required: false, description: 'medium, high or critical.' },
      { name: 'min_support', type: 'integer', required: false, description: 'Minimum co-occurrence count.' },
      { name: 'trace', type: 'TraceContext', required: false, description: 'trace_id, client_id and metadata_tag.' },
    ],
    output: [
      { name: 'ok', type: 'boolean', required: true, description: 'Whether the upstream call succeeded.' },
      { name: 'data.correlations[]', type: 'object[]', required: false, description: 'Related alarm patterns.' },
      { name: 'trace', type: 'object', required: true, description: 'Method, URL, status, duration and attempts.' },
    ],
    errorCodes: [
      { code: 'alarm_api_error', meaning: 'Invalid correlation request or source-system error.' },
      { code: 'timeout', meaning: 'Alarm API did not respond inside MCP_TOOL_TIMEOUT_MS.' },
    ],
    exampleInput: { asset_ids: ['BFP-101'], min_support: 1 },
    exampleOutput: { ok: true, data: { correlations: [{ related_alarm_name: 'Suction Pressure Low' }] } },
  }),
  alarmTool({
    name: 'score_alarm_priority',
    title: 'Score alarm priority',
    description: 'Score a single alarm and explain the contributing severity, criticality and recurrence factors.',
    operation: 'POST /alarms/priority-score',
    timeoutMs: 15000,
    retries: 2,
    input: [
      { name: 'alarm_id', type: 'string', required: true, description: 'Alarm identifier from get_alarms.' },
      { name: 'trace', type: 'TraceContext', required: false, description: 'trace_id, client_id and metadata_tag.' },
    ],
    output: [
      { name: 'ok', type: 'boolean', required: true, description: 'Whether the upstream call succeeded.' },
      { name: 'data.score', type: 'number', required: false, description: 'Composite score from 0 to 100.' },
      { name: 'data.priority_band', type: 'string', required: false, description: 'Priority label such as urgent.' },
      { name: 'trace', type: 'object', required: true, description: 'Method, URL, status, duration and attempts.' },
    ],
    errorCodes: [
      { code: 'alarm_api_error', meaning: 'Alarm identifier was not found or the API rejected the request.' },
      { code: 'timeout', meaning: 'Alarm API did not respond inside MCP_TOOL_TIMEOUT_MS.' },
    ],
    exampleInput: { alarm_id: 'ALM-BFP101-DP-HH' },
    exampleOutput: { ok: true, data: { score: 94, priority_band: 'urgent' } },
  }),
  alarmTool({
    name: 'get_operator_recommendations',
    title: 'Get operator recommendations',
    description:
      'Return source-system operator action recommendations for an alarm with optional related-asset and history context.',
    operation: 'POST /recommendations/operator-actions',
    timeoutMs: 15000,
    retries: 2,
    input: [
      { name: 'alarm_id', type: 'string', required: true, description: 'Alarm identifier from get_alarms.' },
      { name: 'include_related', type: 'boolean', required: false, description: 'Include related asset guidance.' },
      { name: 'include_asset_context', type: 'boolean', required: false, description: 'Include resolved asset context.' },
      { name: 'include_historical_pattern', type: 'boolean', required: false, description: 'Include historical pattern context.' },
      { name: 'trace', type: 'TraceContext', required: false, description: 'trace_id, client_id and metadata_tag.' },
    ],
    output: [
      { name: 'ok', type: 'boolean', required: true, description: 'Whether the upstream call succeeded.' },
      { name: 'data.recommendations[]', type: 'object[]', required: false, description: 'Ordered source-system actions.' },
      { name: 'trace', type: 'object', required: true, description: 'Method, URL, status, duration and attempts.' },
    ],
    errorCodes: [
      { code: 'alarm_api_error', meaning: 'Alarm identifier was not found or recommendations failed.' },
      { code: 'timeout', meaning: 'Alarm API did not respond inside MCP_TOOL_TIMEOUT_MS.' },
    ],
    exampleInput: { alarm_id: 'ALM-BFP101-DP-HH', include_related: true },
    exampleOutput: { ok: true, data: { recommendations: [{ action_text: 'Verify discharge valve position.' }] } },
  }),
]
