# Backend

Python backend for Alarm Copilot.

## Contents

| Path | Purpose |
| --- | --- |
| `server.py` | Copilot HTTP API used by the frontend |
| `agent/` | LangGraph master orchestrator, specialist agents and tool adapters |
| `alarm_api/` | Local Alarm Management API simulator |

## Agent Modules

| Module | Purpose |
| --- | --- |
| `agent/master_graph.py` | Master planner, dispatch loop and final synthesis |
| `agent/graph.py` | Unstructured RAG agent graph |
| `agent/events.py` | Streaming status events emitted to the UI |
| `agent/tools/structured_mcp.py` | Structured ReAct-style MCP investigation path |
| `agent/tools/unstructured_rag.py` | RAG specialist tool wrapper |
| `agent/tools/mcp_client.py` | MCP client bridge to the alarm-management server |

## Run

```bash
PYTHONPATH="$PWD/mcp-servers/alarm-management:$PWD" \
.venv/bin/python apps/backend/server.py --host 127.0.0.1 --port 8080
```
