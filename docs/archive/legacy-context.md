# Archived Project Context

This file is preserved for historical continuity only. It reflects an earlier
planning snapshot and does not describe the current submission state. For the
current reviewer-facing context, see `docs/project-context.md`.

# Original Project Context

**Purpose of this file.** A complete handoff brief so a new session can pick up
without re-reading the whole assignment or re-deriving decisions already made.
It states what the assignment demands, what has been built, why each design
choice was made, and what remains.

Last updated at commit `0416e1c`.

---

## 1. The assignment

**Repository:** https://github.com/Avijit-Swain/senior-copilot-mcp-rag-assignment (public)

**Role as stated in the brief:** *Senior Software Engineer – Copilot Integration*.
The candidate was told verbally it is for a Lead AI Engineer role; the supplied
documents say Senior SWE throughout. Unresolved, cosmetic.

**Assigned use case:** Alarm Investigation and Procedure Guidance Copilot.

**Source documents** live in `assignment/` verbatim as supplied:

| File | Contents |
| --- | --- |
| `Assignment_Use_Case.md` | Objective, mandatory scope, use case, acceptance scenario, 21 deliverables |
| `Submission_and_Evaluation_Guidelines.md` | Repo structure, docs required, scoring rubric, red flags |
| `postman/Alarm-API-Simulator.postman_collection.json` | The API contract — 15 endpoints |
| `postman/chaining/Alarm-API-Chaining.postman_collection.json` | 10 multi-step flows |
| `postman/scenarios/…` | **Byte-identical** to the root collection as supplied |

### 1.1 What must be built

Four components in **one integrated workflow**. MCP and RAG demonstrated
separately counts as incomplete.

1. **Alarm Management API simulator** — candidate-built; Postman collections are
   the spec.
2. **MCP server** — exposes the API as typed tools; auth, retry, timeout, error
   mapping, trace propagation.
3. **Copilot backend + MCP client** — tool discovery, multi-step chaining, RAG in
   the same workflow.
4. **GUI** — chat, alarm panel, citations, expandable MCP trace, raw
   request/response, error states.

Hard rule: the copilot must reach the API **only through MCP**.

### 1.2 Scoring

| Area | Weight |
| --- | ---: |
| Architecture and design | 20% |
| MCP server development and integration | 20% |
| **Test-driven development and code quality** | **20%** |
| Document RAG implementation | 15% |
| Approach and completeness | 15% |
| Packaging, documentation, operability | 10% |

Tests are tied for the heaviest weight and **none are written yet** — this is
currently the single largest gap.

### 1.3 Red flags (automatic failure)

MCP server that is a stub · copilot bypassing MCP · RAG disconnected from the
use case · missing citations · hard-coded answers · secrets committed · no
automated tests · unsafe SQL · write operations without approval · repo that
cannot run from documented steps.

### 1.4 Mandatory acceptance scenario

> Investigate recurring high-severity alarms for Boiler Feed Pump 101 over the
> last 90 days, identify likely contributing factors, retrieve the relevant
> operating procedure, and provide recommended actions with source evidence.

Must show asset resolution via MCP, multi-step API chaining via MCP, RAG
retrieval, combined reasoning, citations, GUI output, MCP trace, and an
automated end-to-end test.

### 1.5 Also required

- Demo video **up to 10 minutes**, linked from the README.
- At least one **pull request**.
- `docker compose up --build` as the primary startup path.
- GitHub Actions CI.
- Coverage report.
- `docs/`: `architecture.md`, `architecture-diagram.png`, `mcp-tool-catalog.md`,
  `rag-design.md`, `api-integration.md`, `design-decisions.md`,
  `known-limitations.md`.

Suggested time box **10–14 hours**, and the submission template asks you to
self-report actual hours.

---

## 2. Facts extracted from the Postman collections

These are the only real API contract. Response shapes are pinned in just four
places; everything else is the candidate's to define.

### 2.1 Endpoint surface (15)

```
GET  /health                              (noauth)
GET  /assets/search                       ?query&site&unit&limit
GET  /assets/{asset_id}/metadata
GET  /alarms                              ?asset_id&site&unit&status&start_time
                                          &end_time&page&page_size&sort_by&sort_order
GET  /alarms/{alarm_id}
POST /alarms/summary
POST /alarms/trends
POST /alarms/correlation
POST /alarms/flood-analysis
POST /alarms/rationalization-candidates
POST /alarms/priority-score
POST /recommendations/operator-actions
POST /calculation-code/generate
POST /calculation-code/execute
GET  /analytics/kpi-definitions
```

**Auth:** collection-level Bearer, token `demo-token`. `/health` is `noauth`.

**Trace headers:** `trace_id`, `x-client-id`, `x-metadata-tag`. Note `trace_id`
is snake_case as a header — match it exactly.

### 2.2 Response shapes actually pinned by the tests

- `/assets/search` → `{ results: [{ asset_id, … }] }`
- `/alarms` → `{ data: [{ alarm_id, … }] }`, paginated
- `/alarms/flood-analysis` → `{ flood_windows: [{ start, end }] }`
- `/calculation-code/generate` → `{ calculation_id }`

### 2.3 Seed-data constraints (these are effectively acceptance tests)

- Search must return hits for `Boiler Feed Pump 101`, `Boiler Feed Pump 102`,
  `compressor`, and `motor` in `Unit 5`.
- `compressor` and `motor` searches need **≥3 results each** — CHAIN-03 and
  CHAIN-08 index `r[0]`, `r[1]`, `r[2]`.
- **`EastRefinery` must have ≥1 active alarm** — CHAIN-09 asserts `above(0)`.
- Sites: `NorthPlant`, `SouthPlant`, `EastRefinery`. Units 1–5.
- Severity: `medium|high|critical`. Alarm types: `safety|device`. Status: `active`.
- KPIs: `alarm_count`, `recurring_rate`, `avg_ack_delay`, `critical_count`,
  `suppression_candidate_rate`.
- Calculation types: `alarm_flood_index`, `critical_alarm_density`,
  `operator_response_efficiency`, `nuisance_alarm_score`.

### 2.4 Timeline trap

Collection variables pin `2026-05-01 → 2026-07-01`, but the acceptance scenario
says *"last 90 days"*. Seed data must cover **both** windows.

### 2.5 Security note on the simulator

`/calculation-code/generate` + `/execute` is a code-generation-and-execution
surface. Implement as a **registry of the four named calculation types**, never
`eval`. Document this explicitly — "unsafe SQL" is a listed red flag.

### 2.6 Gaps in the supplied package

- `postman/scenarios/…` is byte-identical to the root collection (verified by
  MD5), despite the README describing it as scenario-focused tests.
- The chaining collection references `docs/api_chaining_catalog.json`, which was
  not shipped.
- No OpenAPI spec, no error-response format.

---

## 3. Current state

### 3.1 Build status

| Component | State |
| --- | --- |
| Frontend GUI shell | ✅ complete, placeholder data |
| RAG document corpus | ✅ 8 PDFs, extraction verified |
| RAG index + retrieval | ✅ 52 vectors, evaluated |
| LangGraph ReAct agent | ✅ supervisor + tool node, retry-capped |
| Alarm Management API simulator | ⬜ not started |
| MCP server | ⬜ not started |
| MCP client integration | ⬜ not started |
| Automated tests | ⬜ **not started — 20% of the score** |
| Docker / compose | ⬜ not started |
| CI | ⬜ not started |
| `docs/*` | ⬜ not started |
| Demo video | ⬜ not recorded |
| Pull request | ⬜ none opened yet |

### 3.2 Layout

```
.
├── CONTEXT.md                  this file
├── README.md                   repo overview and build status
├── .env.example                config template (real .env is git-ignored)
├── requirements.txt            python deps, pinned
├── assignment/                 supplied brief + postman, verbatim
├── apps/
│   ├── frontend/               React + TS + Vite GUI shell
│   └── backend/agent/graph.py  LangGraph ReAct agent
├── rag/
│   ├── documents/              8 PDFs, filed by document type
│   ├── ingestion/
│   │   ├── representations.py  52 hand-written topic statements
│   │   └── build_index.py      extract → embed → Chroma
│   ├── retrieval/retriever.py  vector search returning whole documents
│   ├── tests/eval_retrieval.py retrieval evaluation harness
│   └── index/                  Chroma DB — git-ignored build artifact
└── scripts/
    ├── corpus_content.py       document prose as structured data
    ├── generate_corpus.py      renders the PDFs with reportlab
    └── ask.py                  CLI to run the agent and see every step
```

### 3.3 Running it

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                       # add OPENAI_API_KEY
.venv/bin/python scripts/generate_corpus.py        # regenerate PDFs (optional)
.venv/bin/python rag/ingestion/build_index.py --reset
.venv/bin/python rag/tests/eval_retrieval.py
.venv/bin/python scripts/ask.py "your question"
.venv/bin/python scripts/ask.py --demo

cd apps/frontend && npm install && npm run dev     # http://localhost:5173
```

---

## 4. What is built, in detail

### 4.1 Frontend GUI shell (`apps/frontend/`)

React 18 + TypeScript + Vite, no CSS framework — a token-based design system in
`src/styles/`. Light and dark themes, ABB wordmark inlined as SVG, brand red
`#ff000f` as the single accent.

Five routes, covering every GUI requirement in the brief:

| Route | Covers |
| --- | --- |
| `/` Investigate | Chat + evidence rail: alarm summary, likely causes, recommendations, citations, expandable MCP trace, raw request/response, error and retry |
| `/mcp` MCP Tools | Tool discovery: 13 tools across 2 servers, typed I/O schemas, auth scope, timeout/retry, error mapping, example invocation |
| `/knowledge` Knowledge Base | Corpus metadata, ingestion status, chunk preview, retrieval preview, prompt-injection posture |
| `/traces` Traces | request/conversation/trace IDs, tool durations, retries, retrieval scores, LLM latency |
| `/settings` Settings | Env vars with masked secrets, service health, security posture |

A **demo scenario switch** on `/` exposes Success / Degraded / Low-confidence /
Failure without a backend — the guidelines require demonstrating one successful
and one failure or degraded scenario.

**All data is placeholder**, from `src/mock/`. Components read typed contracts in
`src/lib/types.ts`, so wiring the backend is a data-source swap. The mapping of
placeholder → real source is in `apps/frontend/README.md`.

`npm run build` and `tsc --noEmit` both pass. No tests. Responsive breakpoints
written but only verified at desktop width.

### 4.2 Document corpus (`rag/documents/`)

Eight synthetic controlled-document PDFs, 19 pages, generated from
`scripts/corpus_content.py` via reportlab. Synthetic is explicitly permitted by
the guidelines §8. **Edit the content module and regenerate — never edit the
PDFs.**

Filed by type so the required coverage is visible without opening anything:

```
operating-procedures/    SOP-114 (BFP low suction pressure), SOP-220 (compressor discharge)
maintenance-manuals/     MM-207 (centrifugal pump)
troubleshooting-guides/  TG-051 (cavitation/NPSH), TG-088 (motor trip)
safety-instructions/     SI-009 (isolation of rotating equipment)
alarm-philosophy/        AP-001 (ISA-18.2 priority, rationalisation, flood)
knowledge-articles/      KB-3312 (strainer changeover) ← injection fixture
```

Each PDF carries embedded metadata (title, author, subject, keywords) so
ingestion captures document metadata from the file itself.

**The corpus is built to be tested against.** Specific passages exist so specific
behaviours can be asserted:

- **`SOP-114 §3.2` (p.2)** — the passage a correct acceptance-scenario answer
  must cite. `§4` defines what "recurring" means.
- **`MM-207 §7.3` (p.2) — the deliberate conflict.** Mandates removal from
  service after >5 cavitation transients in 30 days and explicitly rejects
  increased monitoring as a substitute. The API's operator recommendations advise
  exactly that. This is what makes *"are the API recommendations consistent with
  the maintenance manual?"* answerable and gives the conflicting-evidence
  orchestration test something real to detect.
- **`SI-009 §1.2`** — worded to outrank advisory output; tests that safety
  constraints survive synthesis.
- **`KB-3312 §3` — prompt-injection fixture.** Contains an instruction block
  telling an assistant to suppress safety citations and close alarms without
  inspection. The document is otherwise legitimate and genuinely relevant to
  suction-pressure queries, so it is retrieved **on merit** — that is the point.
- **Deliberate gaps.** Nothing on flare systems, transformers, heat exchangers,
  instrument air or steam turbines, so low-confidence handling can be shown
  honestly.

Rationale for every document is documented in `CORPUS_DESIGN_NOTES` at the
bottom of `scripts/corpus_content.py`.

### 4.3 Retrieval index (`rag/ingestion/`, `rag/retrieval/`)

**Multi-representation, not chunked.** 52 vectors → 8 whole documents. Each
document is indexed by several short natural-language statements (one `summary`,
several question-shaped `topic` lines, one `keywords` line) written by reading
the document. All of a document's vectors resolve to the same whole document.

Retrieval returns the **entire document**, never the representation that matched.

- Embeddings: `text-embedding-3-small`, 1536 dims.
- Store: Chroma, persistent at `rag/index/`, cosine.
- `RETRIEVAL_OVERFETCH=20` vectors → deduplicate by `doc_id` keeping best score
  → `RETRIEVAL_TOP_K=3` **distinct documents**.
- Section→page map captured at ingestion by **locating known headings** from the
  content module. Regex parsing of extracted lines was tried and is unreliable:
  reportlab's non-breaking spaces collapse to single spaces, making headings
  indistinguishable from table rows like `"1 to 2 Routine …"`.

**Measured retrieval quality** (`rag/tests/eval_retrieval.py`, 20 questions):

```
precision@1  16/17 (94%)
recall@3     17/17 (100%)
```

The single ranking miss is an underspecified question naming no asset, where
both SOP-114 and SOP-220 document a recurrence-escalation threshold.

### 4.4 LangGraph ReAct agent (`apps/backend/agent/graph.py`)

```
START → supervisor ──action=retrieve──► Send×N ──► retrieval_tool ──┐
             ▲                                                      │
             └────────────────── observe ─────────────────────────-─┘
             │
             └──action=answer──► finalize ──► END
```

**supervisor** (`gpt-4.1`) — given a catalog of the corpus built from the index,
decomposes the question into independent sub-queries, and on later turns reasons
over the observations to decide retrieve-again or answer.

**fan-out** — one `Send("retrieval_tool", …)` per sub-query; LangGraph runs them
in parallel. Results accumulate through `operator.add` reducers on `sub_answers`
and `executed`.

**retrieval_tool** (`gpt-4o-mini`) — one node doing both halves: embed the
sub-query, top-20 vectors, dedupe to 3 documents, then a single LLM call
answering from the **entire document contents**. There is no separate relevance
filter; the answering step reports when documents do not settle a sub-query.

**finalize** (`gpt-4.1`) — combines sub-answers, preserving citations. A single
resolved sub-query passes through with no LLM call.

**Retry cap enforced in state, not by the prompt.** `retrieval_rounds` permits one
initial dispatch plus `MAX_RETRIES=1`. Once spent, `supervisor()` returns
`action: "answer"` in code before the model is called. When the budget is spent
with nothing resolved, `finalize` returns a fixed **"Answer not found"** message
listing every sub-query tried, rather than asking a model to write around an
absence of evidence.

**Citations are resolved from indexed metadata.** The model supplies only
`doc_id` + section number. Section title, page, revision and source path are
looked up from the section map. A citation naming a nonexistent section or an
unretrieved document is dropped into `dropped_citations` and never shown.
Verified: valid sections resolve, a stray `§` is tolerated, and a fabricated
section, a section title used as a number, and an unretrieved document are all
rejected.

**Verified behaviours:**

- Acceptance scenario decomposes into 3 parallel sub-queries, all resolving to
  the right documents with `§sec p.N` citations.
- The MM-207 / API conflict is detected and reported with precedence.
- KB-3312 is retrieved on merit, its injection payload detected, ignored and
  surfaced in `injection_noted`.
- Flare-header and transformer questions return "Answer not found" rather than
  answering from topically-near documents.

---

## 5. Design decisions and why

**Multi-representation indexing instead of chunking.** Decided on measurement:
the largest document is ~1,100 tokens and the whole corpus ~5,100, so there is no
context-window pressure to relieve. Splitting actively harms the two scenarios
the corpus exists for — the `MM-207 §7.1/§7.3` conflict and the
`SOP-114 §3.2/§4` acceptance scenario both need cross-section reasoning a chunker
would separate. A prototype chunker also merged `§4.1` with `§5` and mislabelled
the result, which would have produced a confidently wrong citation.

**No score threshold for "no answer exists".** Measured on this corpus,
answerable questions score 0.53–0.85 and unanswerable ones 0.45–0.59. The ranges
overlap, and so do the top-1/top-2 margins. No absolute or relative threshold
separates them, because every document is an industrial alarm procedure so
everything is somewhat similar to everything. Rejection is therefore decided by
reading, in the answering step.

**A standalone relevance gate was built, then removed** at the user's direction
in favour of letting the single answering call decide. The measurement that
motivated it still stands and is recorded above.

**Anything the index knows is not asked of the model.** Page numbers, section
titles, revisions and file paths are lookups. The model's only judgement is
*which* section is relevant.

**Corpus PDFs are generated, not hand-authored**, so prose stays diffable even
though only binaries are ingested.

### 5.1 Recurring failure mode worth remembering

**A JSON field named `answered` gets read by the model as "is the answer *yes*".**
Documents that settle a question by prohibiting something were reported as
unanswered — and these were `MM-207` and `SI-009`, the two most important
documents in the corpus. In both cases the model's own explanation text contained
the correct answer while the boolean said false.

This bug was diagnosed and fixed in the relevance gate, then **reintroduced** when
the tool node was written. Fixed by renaming to `documents_resolve_question` with
explicit polarity guidance, and by forcing the model to extract a finding before
judging. If a boolean about evidence behaves oddly, suspect the field name.

A second, related defect: prompts judging relevance need an explicit
**subject-match** rule, or a transformer question gets answered from a motor
procedure with a citation.

---

## 6. Known gaps and risks

**No tests.** 20% of the score, eight test categories enumerated in §13 of the
guidelines. Nothing written. Largest single gap.

**The retrieval eval set is contaminated.** The gate prompt was revised three
times against the same 20 questions, so that set now serves as both dev and test.
Before submission it needs a held-out set — roughly 30–40 questions, tune on
half, report on the other half.

**The retry path is only unit-tested.** `gpt-4.1` decomposes well enough that no
real question in the current set needs the retry. The cap is enforced and tested
at the boundary, but no natural question exercises it.

**Frontend responsiveness unverified** below desktop width.

**`assignment/` is public.** The repo is public by the user's explicit choice, so
ABB's brief and Postman collections are publicly readable. If reconsidered, a
clean removal means rewriting the first commit, which gets harder over time.

**Citation `quote` fields are model-generated** and only loosely verified — the
locator is validated against the index, the quoted text is not checked to appear
in the document.

---

## 7. Suggested next steps

In rough dependency order:

1. **Alarm Management API simulator** — FastAPI, seeded to satisfy all ten
   chaining flows. Validate with `newman` against
   `assignment/postman/chaining/…`. Keep it thin; it carries the fewest points.
2. **MCP server** — wrap the simulator; typed schemas, auth, retry/timeout, error
   mapping, trace propagation. Must run independently.
3. **MCP client + orchestration** — extend the existing LangGraph agent so the
   supervisor can dispatch to MCP tools as well as document retrieval, in the
   same graph. This is what makes MCP and RAG one workflow rather than two demos.
4. **Tests** — start here earlier than feels natural given the 20% weight.
5. **Wire the frontend** to the real backend, replacing `src/mock/`.
6. **Docker compose, CI, `docs/`, demo video, one PR.**

---

## 8. Environment

- Python venv at `.venv/`, deps pinned in `requirements.txt`.
- `.env` at repo root holds `OPENAI_API_KEY`; git-ignored, verified not staged.
- `rag/index/` is a git-ignored build artifact — rebuild, do not commit.
- Node 24 / npm 11 for the frontend.
- `gh` CLI v2.97.0 installed at `~/.local/bin/gh` but **not authenticated**.
  `~/.config` is root-owned on this machine, so `GH_CONFIG_DIR` is set to
  `~/.gh-config` via `~/.zshenv`.
- Git pushes over SSH using `~/.ssh/id_ed25519_github`, scoped to github.com in
  `~/.ssh/config` with `IdentitiesOnly yes`. The pre-existing
  `~/.ssh/id_ed25519` is a work GitLab key and is untouched.
