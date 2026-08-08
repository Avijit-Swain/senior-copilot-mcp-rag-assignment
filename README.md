# Alarm Investigation and Procedure Guidance Copilot

Submission for the ABB **Copilot Integration** assignment.

A copilot that performs evidence-backed alarm investigations: it accepts a
natural-language question, resolves the asset, chains MCP tools against an Alarm
Management API simulator, retrieves matching site documentation through RAG, and
answers with citations and a full tool-execution trace.

> **Status: in progress.** The GUI shell is complete and runnable. The API
> simulator, MCP server, RAG pipeline and orchestration layer are not built yet.
> See [Build status](#build-status).

## Repository layout

```
.
├── assignment/            Assignment brief, evaluation guidelines and the
│                          reference Postman collections, exactly as supplied.
│                          Input material — not part of the deliverable.
├── apps/
│   └── frontend/          React + TypeScript GUI          ✅ shell complete
├── docs/                  Architecture, MCP tool catalog, RAG design       ⬜
├── mcp-servers/           Candidate-developed MCP server(s)                ⬜
├── rag/                   Ingestion, retrieval, document corpus            ⬜
├── connectors/            Alarm Management API client                      ⬜
├── tests/                 unit / integration / e2e                         ⬜
└── scripts/                                                                ⬜
```

This follows the structure in `assignment/Submission_and_Evaluation_Guidelines.md`
§3, with one addition: `assignment/` holds the supplied brief and Postman
collections so the whole exercise lives in a single repository. The guidelines
permit equivalent structures when documented.

## Build status

| Component | State |
| --- | --- |
| GUI (React) | Shell complete — all required screens, placeholder data |
| Alarm Management API simulator | Not started |
| MCP server | Not started |
| MCP client / orchestration | Not started |
| RAG ingestion and retrieval | Not started |
| Tests | Not started |
| Docker packaging | Not started |
| CI | Not started |

## Running what exists

```bash
cd apps/frontend
npm install
npm run dev        # http://localhost:5173
```

See [`apps/frontend/README.md`](apps/frontend/README.md) for the screen
inventory, the demo scenario switch, and the map of which placeholder feeds
which panel.

## Reference material

| File | What it is |
| --- | --- |
| `assignment/Assignment_Use_Case.md` | The brief: scope, use case, mandatory acceptance scenario, deliverables |
| `assignment/Submission_and_Evaluation_Guidelines.md` | Repo structure, documentation requirements, scoring rubric, red flags |
| `assignment/postman/Alarm-API-Simulator.postman_collection.json` | The API contract — 15 endpoints, auth and trace headers |
| `assignment/postman/chaining/Alarm-API-Chaining.postman_collection.json` | Ten multi-step flows; these double as acceptance tests for the simulator |
| `assignment/postman/scenarios/…` | Byte-identical to the root collection as supplied; kept for fidelity |
