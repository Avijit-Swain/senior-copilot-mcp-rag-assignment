# Tests

Automated tests are grouped by scope.

| Path | Scope |
| --- | --- |
| `unit/` | MCP client behavior and master-orchestrator routing |
| `integration/` | Alarm API simulator and backend response normalization |
| `e2e/` | Required BFP-101 acceptance scenario at the copilot layer |

Run the complete Python suite:

```bash
PYTHONPATH="$PWD/mcp-servers/alarm-management:$PWD" \
.venv/bin/python -m pytest tests -q
```

Run the suite with coverage:

```bash
make coverage
```

The optional retrieval evaluation remains in `rag/tests/` because it validates
the RAG corpus/index rather than the backend API surface.
