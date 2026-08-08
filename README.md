# Alarm Investigation and Procedure Guidance Copilot

Submission for the ABB **Copilot Integration** assignment.

A copilot that performs evidence-backed alarm investigations: it accepts a
natural-language question, resolves the asset, chains MCP tools against an Alarm
Management API simulator, retrieves matching site documentation through RAG, and
answers with citations and a full tool-execution trace.

> **Status: in progress.** The GUI shell, the RAG corpus, the retrieval index and
> a LangGraph ReAct agent over it are built and runnable. The API simulator, MCP
> server and MCP client integration are not. See [Build status](#build-status).
>
> **[`CONTEXT.md`](CONTEXT.md) is the full handoff brief** — what the assignment
> demands, what exists, why each design decision was made, and what remains.

## Repository layout

```
.
├── CONTEXT.md             Full handoff brief — read this first
├── assignment/            Assignment brief, evaluation guidelines and the
│                          reference Postman collections, exactly as supplied.
│                          Input material — not part of the deliverable.
├── apps/
│   ├── frontend/          React + TypeScript GUI          ✅ shell complete
│   └── backend/agent/     LangGraph ReAct agent           ✅ over documents
├── rag/                   Corpus, ingestion, retrieval    ✅
├── scripts/               Corpus generation, agent CLI    ✅
├── docs/                  Architecture, MCP tool catalog, RAG design       ⬜
├── mcp-servers/           Candidate-developed MCP server(s)                ⬜
├── connectors/            Alarm Management API client                      ⬜
└── tests/                 unit / integration / e2e                         ⬜
```

This follows the structure in `assignment/Submission_and_Evaluation_Guidelines.md`
§3, with one addition: `assignment/` holds the supplied brief and Postman
collections so the whole exercise lives in a single repository. The guidelines
permit equivalent structures when documented.

## Build status

| Component | State |
| --- | --- |
| GUI (React) | ✅ Shell complete — all required screens, placeholder data |
| RAG document corpus | ✅ 8 PDFs, text extraction verified |
| RAG index and retrieval | ✅ 52 vectors → 8 documents, precision@1 94% |
| LangGraph ReAct agent | ✅ Supervisor + parallel retrieval tool, retry-capped |
| Alarm Management API simulator | ⬜ Not started |
| MCP server | ⬜ Not started |
| MCP client / orchestration | ⬜ Not started |
| Tests | ⬜ Not started |
| Docker packaging | ⬜ Not started |
| CI | ⬜ Not started |

## Running what exists

**Document copilot** — ask a question, watch the agent decompose, retrieve and cite:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                                  # add OPENAI_API_KEY
.venv/bin/python rag/ingestion/build_index.py --reset
.venv/bin/python scripts/ask.py --demo
```

**Retrieval evaluation:**

```bash
.venv/bin/python rag/tests/eval_retrieval.py
```

**GUI:**

```bash
cd apps/frontend && npm install && npm run dev        # http://localhost:5173
```

See [`rag/README.md`](rag/README.md) for the corpus design and
[`apps/frontend/README.md`](apps/frontend/README.md) for the screen inventory
and the map of which placeholder feeds which panel.

## Reference material

| File | What it is |
| --- | --- |
| `assignment/Assignment_Use_Case.md` | The brief: scope, use case, mandatory acceptance scenario, deliverables |
| `assignment/Submission_and_Evaluation_Guidelines.md` | Repo structure, documentation requirements, scoring rubric, red flags |
| `assignment/postman/Alarm-API-Simulator.postman_collection.json` | The API contract — 15 endpoints, auth and trace headers |
| `assignment/postman/chaining/Alarm-API-Chaining.postman_collection.json` | Ten multi-step flows; these double as acceptance tests for the simulator |
| `assignment/postman/scenarios/…` | Byte-identical to the root collection as supplied; kept for fidelity |
