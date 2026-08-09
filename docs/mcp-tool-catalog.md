# MCP Tool Catalog

The Alarm Management MCP server lives in `mcp-servers/alarm-management` and wraps the candidate-built Alarm Management API simulator. All tools propagate `trace_id`, `x-client-id`, and `x-metadata-tag` headers when supplied through the `trace` input object. Authentication uses `ALARM_API_TOKEN`; secrets are never returned in tool responses.

## Running Independently

Start the Alarm Management API simulator first:

```bash
.venv/bin/python apps/backend/alarm_api/server.py --host 127.0.0.1 --port 8000
```

Then start the MCP server:

```bash
PYTHONPATH=mcp-servers/alarm-management \
ALARM_API_BASE_URL=http://127.0.0.1:8000 \
ALARM_API_TOKEN=replace-me \
.venv/bin/python -m alarm_mcp.server
```

The copilot backend discovers these tool contracts through its MCP client path
and invokes them from the structured LangGraph agent.

## Shared Behavior

- Input schemas are typed with Pydantic models.
- Invalid inputs are rejected before API invocation.
- API errors are mapped into structured MCP errors.
- Timeouts use `MCP_TOOL_TIMEOUT_MS`, default `15000`.
- Retries use `MCP_TOOL_MAX_RETRIES`, default `2`.
- Trace metadata is propagated when supplied in the `trace` input.
- Authentication is read from environment variables and not exposed in outputs.

## `search_assets`

Purpose: Resolve natural-language asset names, tags, or asset types to simulator asset IDs.

Input schema: `query`, optional `site`, optional `unit`, `limit`, optional `trace`.

Output schema: `{ ok, tool, data: { results, count }, trace }` or `{ ok: false, error, trace }`.

Underlying operation: `GET /assets/search`.

Error behavior: Validation rejects empty query; API errors are mapped into `error.status_code` and `error.payload`.

Timeout/retry: Uses `MCP_TOOL_TIMEOUT_MS`, default 15000 ms, and `MCP_TOOL_MAX_RETRIES`, default 2.

Example: `search_assets({"query":"Boiler Feed Pump 101","limit":10})`.

## `get_asset_metadata`

Purpose: Fetch asset metadata, site/unit context, and related assets.

Input schema: `asset_id`, optional `trace`.

Output schema: `{ ok, tool, data: { asset_id, asset_name, metadata, related_assets }, trace }`.

Underlying operation: `GET /assets/{asset_id}/metadata`.

Error behavior: Missing assets return mapped 404 errors.

Example: `get_asset_metadata({"asset_id":"BFP-101"})`.

## `get_alarms`

Purpose: Retrieve active or historical alarms with filters and pagination.

Input schema: optional `asset_id`, `site`, `unit`, `status`, `start_time`, `end_time`, `page`, `page_size`, `sort_by`, `sort_order`, optional `trace`.

Output schema: `{ ok, tool, data: { data, pagination }, trace }`.

Underlying operation: `GET /alarms`.

Error behavior: Non-2xx API responses are returned as structured tool errors.

Example: `get_alarms({"asset_id":"BFP-101","page":1,"page_size":50})`.

## `get_alarm_summary`

Purpose: Calculate grouped alarm KPIs such as count, recurrence rate, and acknowledgement delay.

Input schema: `asset_ids`, `time_range`, `severity`, `group_by`, `kpis`, optional `trace`.

Output schema: `{ ok, tool, data: { summary, total_alarms, filters }, trace }`.

Underlying operation: `POST /alarms/summary`.

Example: `get_alarm_summary({"asset_ids":["BFP-101"],"severity":["high","critical"]})`.

## `correlate_alarms`

Purpose: Return correlated alarms and explanations for one or more assets.

Input schema: `asset_ids`, `time_range`, `correlation_method`, `lag_window_minutes`, `severity_threshold`, `min_support`, optional `trace`.

Output schema: `{ ok, tool, data: { correlation_method, correlations }, trace }`.

Underlying operation: `POST /alarms/correlation`.

Example: `correlate_alarms({"asset_ids":["BFP-101"],"lag_window_minutes":15})`.

## `score_alarm_priority`

Purpose: Score priority for a specific alarm and return contributing factors.

Input schema: `alarm_id`, optional `trace`.

Output schema: `{ ok, tool, data: { alarm_id, score, priority_band, factors }, trace }`.

Underlying operation: `POST /alarms/priority-score`.

Example: `score_alarm_priority({"alarm_id":"ALM-BFP101-DP-HH"})`.

## `get_operator_recommendations`

Purpose: Return operator actions, rationale, urgency, and ranking for an alarm.

Input schema: `alarm_id`, `include_related`, `include_asset_context`, `include_historical_pattern`, optional `trace`.

Output schema: `{ ok, tool, data: { alarm, recommendations, include_related }, trace }`.

Underlying operation: `POST /recommendations/operator-actions`.

Example: `get_operator_recommendations({"alarm_id":"ALM-BFP101-DP-HH","include_related":true})`.
