# API Integration

The structured source system is a local Alarm Management API simulator backed by
SQLite. The copilot does not call this API directly from the orchestration layer;
Alarm API access flows through the candidate-developed MCP server.

## Components

| Component | Location | Responsibility |
| --- | --- | --- |
| SQL schema | `connectors/alarm_api/schema.sql` | Source of truth for simulator tables |
| Seed data | `connectors/alarm_api/seed.sql` | Deterministic alarm-management data |
| SQLite DB | `test-data/alarm_management.sqlite3` | Runtime simulator database |
| API simulator | `apps/backend/alarm_api/service.py` | HTTP source-system simulator |
| MCP server | `mcp-servers/alarm-management` | MCP wrapper around API operations |
| MCP client | `apps/backend/agent/tools/mcp_client.py` | Tool discovery and invocation path |
| Structured agent | `apps/backend/agent/tools/structured_mcp.py` | ReAct supervisor over MCP tools |

## Simulator Startup

Initialize the database:

```bash
.venv/bin/python scripts/init_alarm_db.py --reset
```

Run the simulator independently:

```bash
.venv/bin/python apps/backend/alarm_api/server.py --host 127.0.0.1 --port 8000
```

The integrated copilot backend can also use the same simulator code path.

## Authentication

The simulator expects an API token. Configure:

```text
ALARM_API_TOKEN=replace-me
```

The MCP server reads this token and sends it to the Alarm Management API. Token
values are never returned in MCP tool responses or GUI traces.

## Trace Metadata

Trace metadata is propagated through:

- `trace_id`
- `x-client-id`
- `x-metadata-tag`

The structured agent supplies trace context to MCP calls, the MCP server passes
it to the API simulator, and the simulator writes trace events to
`api_trace_events`.

## Main API Capabilities

The simulator implements the assignment's alarm-management surface, including:

- asset search,
- asset metadata and relationships,
- alarm listing with filters and pagination,
- alarm detail,
- grouped summaries,
- trends,
- correlation,
- flood analysis,
- rationalization candidates,
- priority scoring,
- operator recommendations,
- KPI and calculation templates,
- trace event capture.

## MCP Integration Contract

The MCP server exposes selected source-system operations as tools:

- `search_assets`
- `get_asset_metadata`
- `get_alarms`
- `get_alarm_summary`
- `correlate_alarms`
- `score_alarm_priority`
- `get_operator_recommendations`

For schemas and examples, see `docs/mcp-tool-catalog.md`.

## Error Handling

The API simulator returns structured HTTP errors. The MCP client maps these into
MCP tool results with:

- `ok: false`,
- error code/message,
- HTTP status,
- response payload where safe,
- trace metadata.

The copilot can continue with partial evidence when non-critical calls fail and
marks the final answer as degraded.

## Pagination

Alarm retrieval supports pagination through `page` and `page_size`. The MCP tool
passes these fields through and returns the simulator pagination envelope.

## Tests

API and MCP integration behavior is covered by:

```bash
PYTHONPATH="$PWD/mcp-servers/alarm-management:$PWD" \
.venv/bin/python -m pytest tests/integration/test_alarm_api_simulator.py tests/unit/test_alarm_mcp_client.py -q
```

These tests validate authentication, chained simulator flows, API client error
mapping and MCP client payload behavior.
