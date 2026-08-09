# Alarm Investigation and Procedure Guidance Copilot

Submission for the ABB Senior Software Engineer Copilot Integration assignment.

Alarm Copilot is an evidence-backed industrial alarm investigation application.
It accepts natural-language questions, plans which data sources are needed,
invokes a candidate-developed Alarm Management MCP server for structured alarm
data, retrieves site documentation through RAG, and returns a grounded answer
with citations and MCP traceability.

## Main Capabilities

- Chat-based alarm investigation UI.
- Master LangGraph orchestrator that can run structured and unstructured agents
  in parallel or sequentially.
- Structured MCP ReAct agent over the Alarm Management API simulator.
- Candidate-developed MCP server in `mcp-servers/alarm-management`.
- Document RAG agent over operating procedures, maintenance manuals,
  troubleshooting guides, safety instructions, alarm philosophy, and knowledge
  articles.
- Right-side evidence rail with citations, recommended actions, likely causes,
  and collapsible previous-turn evidence/trace sections.
- Context retention for follow-up questions.
- Structured and unstructured data-source preview pages.
- Low-confidence, degraded, error, retry, and loading states.

## Current Build Status

| Component | State |
| --- | --- |
| React GUI | Complete local app with chat, evidence, MCP trace, settings, MCP catalog, structured/unstructured data views |
| Alarm Management API simulator | Implemented with `aiohttp` and SQLite seed data |
| Candidate MCP server | Implemented in `mcp-servers/alarm-management` |
| MCP client integration | Implemented through the backend structured agent |
| Structured agent | LangGraph ReAct-style supervisor plus MCP tool node |
| Unstructured RAG agent | LangGraph document agent over Chroma retrieval |
| Master orchestrator | LangGraph planner with parallel and sequential dispatch |
| RAG corpus/index | 8 synthetic PDFs, Chroma index, document deduplication and relevance gate |
| Tests | Unit, integration and E2E tests for API, MCP client, orchestration, backend flows and acceptance proof |
| E2E acceptance proof | Automated BFP-101 acceptance test and evidence doc included |
| Packaging | Dockerfile, Docker Compose and Makefile included |
| CI | GitHub Actions workflow included |
| Demo video | Pending outside the repository |

## Repository Layout

```text
.
├── .github/workflows/       CI for backend, frontend, packaging and optional RAG eval
├── assignment/              Supplied assignment brief and Postman collections
├── apps/
│   ├── backend/             Copilot API, LangGraph agents, Alarm API simulator
│   └── frontend/            React + TypeScript GUI
├── connectors/alarm_api/    SQL schema and seed source of truth
├── docs/                    Architecture, MCP, RAG, API and decision docs
├── Dockerfile               Multi-stage backend/frontend container build
├── docker-compose.yml       Local three-service stack
├── Makefile                 Convenience commands for compose operations
├── mcp-servers/
│   └── alarm-management/    Candidate-developed MCP server
├── rag/
│   ├── documents/           Synthetic PDF corpus
│   ├── ingestion/           Index builder and representation generation
│   ├── index/               Ignored local Chroma index build artifact
│   └── retrieval/           Retriever and relevance helpers
├── scripts/                 Corpus and DB setup scripts
├── test-data/               SQLite simulator DB
└── tests/                   Unit, integration and E2E tests
```

## Technology Stack

| Layer | Technology |
| --- | --- |
| GUI | React, TypeScript, Vite |
| Backend API | Python, aiohttp |
| Orchestration | LangGraph |
| LLM calls | OpenAI-compatible chat/completions client |
| MCP | Python MCP SDK, stdio server |
| Structured source | SQLite-backed Alarm Management API simulator |
| RAG | PDF extraction, multi-representation Chroma index, OpenAI embeddings |
| Tests | pytest, pytest-asyncio, pytest-cov, TypeScript compiler, Vite build |

## Architecture

See:

- `docs/architecture.md`
- `docs/architecture-diagram.md`
- `docs/mcp-tool-catalog.md`
- `docs/rag-design.md`
- `docs/api-integration.md`
- `docs/design-decisions.md`
- `docs/e2e-acceptance.md`
- `docs/known-limitations.md`
- `docs/project-context.md`

## Configuration

Copy `.env.example` to `.env` and set the required values:

```bash
cp .env.example .env
```

The main variables are:

- `OPENAI_API_KEY`
- `MASTER_MODEL`
- `STRUCTURED_SUPERVISOR_MODEL`
- `SUPERVISOR_MODEL`
- `TOOL_MODEL`
- `EMBEDDING_MODEL`
- `ALARM_API_BASE_URL`
- `ALARM_API_TOKEN`
- `ALARM_DB_PATH`
- `VECTOR_INDEX_PATH`
- `BACKEND_PORT`
- `CORS_ORIGIN`

Secrets belong in `.env`; do not commit them.

## Local Setup

Install Python dependencies:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Install frontend dependencies:

```bash
cd apps/frontend
npm install
```

Initialize or refresh the simulator database:

```bash
.venv/bin/python scripts/init_alarm_db.py --reset
```

Build or refresh the RAG index:

```bash
.venv/bin/python rag/ingestion/build_index.py --reset
```

## Running Locally

Start the copilot backend:

```bash
.venv/bin/python apps/backend/server.py --host 127.0.0.1 --port 8080
```

Start the frontend:

```bash
cd apps/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173/
```

The backend exposes:

- `GET /api/health`
- `POST /api/chat`
- `POST /api/chat/stream`
- `GET|POST /api/knowledge/search`
- `GET /api/knowledge/documents/{doc_id}/pdf`
- `GET /api/structured/preview`

## Docker Compose

Validate the compose file:

```bash
docker compose config
```

Start the local stack:

```bash
docker compose up --build
```

The compose stack starts:

- `alarm-api` on port `8000`,
- `backend` on port `8080`,
- `frontend` on port `5173`.

If `rag/index/` has not been built locally, set `OPENAI_API_KEY` so the backend
container can build the vector index during startup.

## Running the Alarm API Simulator Independently

```bash
.venv/bin/python apps/backend/alarm_api/server.py --host 127.0.0.1 --port 8000
```

The simulator uses `ALARM_API_TOKEN` and trace headers such as
`x-trace-id`, `x-client-id`, and `x-metadata-tag`.

## Running the MCP Server Independently

```bash
PYTHONPATH=mcp-servers/alarm-management \
ALARM_API_BASE_URL=http://127.0.0.1:8000 \
ALARM_API_TOKEN=replace-me \
.venv/bin/python -m alarm_mcp.server
```

The copilot backend invokes this server through the structured MCP client path.
For tool details, see `docs/mcp-tool-catalog.md`.

## Sample Questions

- Investigate recurring BFP-101 high-severity alarms and recommend cited actions.
- Show active critical alarms for Boiler Feed Pump 102 and recommend immediate actions.
- Which alarm has the highest priority in EastRefinery, and why?
- When should a centrifugal pump be removed from service instead of monitored?
- What should we do for the active Motor Trip on MTR-301 before inspection?
- Do BFP-101 API recommendations match the manual and safety guidance?

## Test Commands

Backend and orchestration tests:

```bash
PYTHONPATH="$PWD/mcp-servers/alarm-management:$PWD" \
.venv/bin/python -m pytest tests -q
```

Coverage report:

```bash
make coverage
```

This writes a terminal coverage summary and `coverage.xml`.

Retrieval evaluation:

```bash
.venv/bin/python rag/tests/eval_retrieval.py
```

Frontend validation:

```bash
cd apps/frontend
npm run typecheck
npm run build
```

## Acceptance Scenario

The primary end-to-end scenario is:

```text
Investigate recurring high-severity alarms for Boiler Feed Pump 101 over the last 90 days,
identify likely contributing factors, retrieve the relevant operating procedure, and provide
recommended actions with source evidence.
```

Expected path:

1. Master orchestrator dispatches structured and unstructured work.
2. Structured agent resolves BFP-101 through MCP.
3. MCP tools retrieve alarms, metadata, summary, correlation, priority and recommendations.
4. RAG retrieves relevant operating procedure/manual/safety passages.
5. Final answer combines alarm evidence with cited document guidance.
6. GUI shows the answer, citations and MCP execution trace.

Automated acceptance evidence is documented in `docs/e2e-acceptance.md` and
implemented in `tests/e2e/test_acceptance_bfp101.py`.

## Assumptions

- The Alarm Management API is a simulator backed by synthetic SQLite data.
- The document corpus is synthetic but structured like controlled plant
  documentation.
- The local Chroma index is a rebuildable artifact and is intentionally ignored.
- Model names are configurable by environment variable.

## Known Limitations

See `docs/known-limitations.md`.
