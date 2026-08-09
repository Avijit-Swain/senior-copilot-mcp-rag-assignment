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
| Tests | Unit and integration tests for API, MCP client, orchestration and backend flows |
| Packaging/CI/demo | Not included yet; see `docs/known-limitations.md` |

## Repository Layout

```text
.
├── assignment/              Supplied assignment brief and Postman collections
├── apps/
│   ├── backend/             Copilot API, LangGraph agents, Alarm API simulator
│   └── frontend/            React + TypeScript GUI
├── connectors/alarm_api/    SQL schema and seed source of truth
├── docs/                    Architecture, MCP, RAG, API and decision docs
├── mcp-servers/
│   └── alarm-management/    Candidate-developed MCP server
├── rag/
│   ├── documents/           Synthetic PDF corpus
│   ├── ingestion/           Index builder and representation generation
│   ├── index/               Local Chroma index
│   └── retrieval/           Retriever and relevance helpers
├── scripts/                 Corpus and DB setup scripts
├── test-data/               SQLite simulator DB
└── tests/                   Unit and integration tests
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
| Tests | pytest, pytest-asyncio, TypeScript compiler, Vite build |

## Architecture

See:

- `docs/architecture.md`
- `docs/architecture-diagram.md`
- `docs/mcp-tool-catalog.md`
- `docs/rag-design.md`
- `docs/api-integration.md`
- `docs/design-decisions.md`
- `docs/known-limitations.md`

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

## Assumptions

- The Alarm Management API is a simulator backed by synthetic SQLite data.
- The document corpus is synthetic but structured like controlled plant
  documentation.
- The local Chroma index is committed for convenience, but it can be rebuilt.
- Model names are configurable by environment variable.

## Known Limitations

See `docs/known-limitations.md`.
