# Frontend — Alarm Investigation and Procedure Guidance Copilot

React + TypeScript GUI for the copilot. This is currently the **UI shell**: every
screen the assignment brief calls for is built and navigable, driven by
placeholder data. No network calls are made yet.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle
npm run typecheck
```

Configuration comes from the environment — see `.env.example`. Only
`VITE_`-prefixed variables reach the browser bundle, so no secret belongs there.

## Screens

| Route | Purpose | Brief requirement covered |
| --- | --- | --- |
| `/` | Investigation workspace — chat plus evidence rail | Chat interaction, alarm summary panel, likely causes, recommendations, citations, MCP trace, raw request/response, error and retry visibility |
| `/mcp` | MCP tool catalog | Tool discovery view, typed input/output schemas, auth scope, timeout and retry policy, error mapping, example invocation and response |
| `/knowledge` | RAG corpus | Document metadata, ingestion status, chunk preview, retrieval preview with scores, prompt-injection posture |
| `/traces` | Observability | Request/conversation/trace IDs, tool durations and outcomes, retry counts, retrieval scores, LLM latency |
| `/settings` | Configuration | Environment variables with masked secrets, service health, security posture |

The investigation page has a **demo scenario switch** (Success / Degraded /
Low confidence / Failure). The brief requires demonstrating one successful and
one failure or degraded scenario; this makes all four reachable without needing
the backend up.

## Layout

```
src/
├── components/
│   ├── AbbLogo.tsx           inline ABB wordmark (no external asset)
│   ├── AppShell.tsx          sidebar, topbar, theme toggle
│   ├── investigate/          chat panel, evidence rail, MCP trace list
│   └── ui/                   badges, cards, drawer, JSON viewer, states
├── lib/
│   ├── types.ts              domain contracts shared across pages
│   ├── theme.tsx             theme provider (single source of truth)
│   └── format.ts             duration, percentage and date formatting
├── mock/                     placeholder data — the only thing to replace
├── pages/                    one file per route
└── styles/                   tokens → base → layout → components → features
```

## Replacing the placeholders

Components read from typed contracts in `src/lib/types.ts`, never from the mock
modules directly beyond a single import at the page level. Wiring up the backend
means swapping the data source, not rewriting components:

| Placeholder | Replace with |
| --- | --- |
| `mock/servers.ts` → `MCP_TOOLS`, `MCP_SERVERS` | MCP `tools/list` response |
| `mock/corpus.ts` → `CORPUS`, `SAMPLE_CHUNKS` | Ingestion manifest and retrieval API |
| `mock/conversation.ts` → `SAMPLE_ANSWER` and variants | Streaming `POST /chat` response |
| `mock/conversation.ts` → `TRACES` | Structured log query |
| `mock/conversation.ts` → `ENV_SETTINGS`, `HEALTH_CHECKS` | `GET /config`, `GET /health` |

The `setTimeout` in `pages/Investigate.tsx` stands in for the orchestrator call.

## Design notes

- **Theming** — light and dark are both first-class. Tokens are defined once per
  theme in `styles/tokens.css`; components never branch on theme. The active
  theme is written to `<html data-theme>` before first paint to avoid a flash.
- **ABB brand** — the wordmark is inlined as SVG and brand red (`#ff000f`) is the
  single accent. Severity, status and score colours are deliberately distinct
  from it so "critical" never reads as "branded".
- **JSON viewer** — serialised output is HTML-escaped before tokens are wrapped
  for highlighting, so document or API content cannot inject markup.

## Known gaps

- No tests yet. Component and interaction tests land with the backend wiring.
- Responsive breakpoints are written (`1180px`, `1000px`, `640px`) but have only
  been verified at desktop width.
- `Run tool` on the MCP catalog and the ingestion buttons on the knowledge base
  are inert until their endpoints exist.
