# Alarm Management MCP Server

Candidate-developed MCP server for the ABB copilot assignment. It exposes typed tools over the local Alarm Management API simulator.

## Tools

- `search_assets`
- `get_asset_metadata`
- `get_alarms`
- `get_alarm_summary`
- `correlate_alarms`
- `score_alarm_priority`
- `get_operator_recommendations`

## Run

Start the API simulator first:

```bash
.venv/bin/python scripts/init_alarm_db.py --reset
ALARM_API_TOKEN=demo-token .venv/bin/python -m apps.backend.alarm_api.server --host 127.0.0.1 --port 8000
```

Then start the MCP server over stdio. Because `mcp-servers/alarm-management` is not an installable package path by default, set `PYTHONPATH` to that directory:

```bash
PYTHONPATH=mcp-servers/alarm-management \
ALARM_API_BASE_URL=http://127.0.0.1:8000 \
ALARM_API_TOKEN=demo-token \
.venv/bin/python -m alarm_mcp.server
```
