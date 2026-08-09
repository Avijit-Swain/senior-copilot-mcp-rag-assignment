# Project Context

This is the current handoff note for the ABB Senior Software Engineer Copilot
Integration assignment. It keeps reviewer-facing project context in `docs/`
instead of leaving stale planning notes at the repository root.

## Assignment Goal

Build an integrated Alarm Investigation and Procedure Guidance Copilot that:

- exposes a candidate-developed Alarm Management MCP server,
- reaches structured alarm data through MCP tools,
- retrieves unstructured site documents through RAG,
- combines both evidence paths in one copilot workflow,
- shows citations, recommendations, likely causes and MCP traceability in a GUI,
- includes automated proof for the required acceptance scenario.

## Implemented Components

| Area | Current state |
| --- | --- |
| Alarm API simulator | Implemented with `aiohttp`, SQLite schema and deterministic seed data |
| MCP server | Implemented in `mcp-servers/alarm-management` with typed alarm-management tools |
| Backend copilot | Implemented in `apps/backend` with LangGraph master, structured and unstructured agents |
| Structured path | ReAct-style structured supervisor plus MCP tool node |
| Unstructured path | RAG over 8 synthetic PDF documents with document dedupe and relevance gating |
| Frontend | React + TypeScript investigation workspace with evidence and MCP trace rails |
| Context retention | Follow-up questions can use previous user/assistant context |
| Tests | Unit, integration and E2E acceptance tests under `tests/` |
| Coverage | Configured with `pytest-cov`; `make coverage` writes `coverage.xml` |
| Packaging | `Dockerfile`, `docker-compose.yml` and `Makefile` included |
| CI | GitHub Actions workflow included in `.github/workflows/ci.yml` |

## Folder Map

```text
.
├── .github/workflows/       GitHub Actions CI
├── apps/
│   ├── backend/             Backend API, Alarm API simulator and agent graphs
│   └── frontend/            React operator UI
├── assignment/              Supplied assignment brief and Postman collections
├── connectors/              Structured data schema and seed source of truth
├── docs/                    Architecture, RAG, MCP, E2E and decision docs
├── mcp-servers/             Candidate-developed MCP server packages
├── rag/                     Synthetic PDF corpus, ingestion and retrieval
├── scripts/                 Setup, corpus generation and CLI helpers
├── test-data/               Generated local SQLite database location
└── tests/                   Unit, integration and E2E tests
```

## Reviewer Entry Points

- Start with `README.md`.
- Review architecture in `docs/architecture.md` and
  `docs/architecture-diagram.md`.
- Review MCP tool coverage in `docs/mcp-tool-catalog.md`.
- Review RAG design in `docs/rag-design.md`.
- Review acceptance evidence in `docs/e2e-acceptance.md`.
- Review remaining submission notes in `docs/known-limitations.md`.

## Verification Commands

```bash
PYTHONPATH="$PWD/mcp-servers/alarm-management:$PWD" \
.venv/bin/python -m pytest tests -q
```

```bash
cd apps/frontend
npm run typecheck
npm run build
```

```bash
docker compose config
```

```bash
make coverage
```
