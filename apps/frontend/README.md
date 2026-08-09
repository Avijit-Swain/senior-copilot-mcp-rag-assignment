# Frontend

React + TypeScript GUI for Alarm Copilot.

The app is no longer a placeholder-only shell. The investigation page calls the
copilot backend, streams status events, displays final grounded answers, and
renders current and previous-turn evidence/MCP traces in the right rail.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle
npm run typecheck
```

Set `VITE_BACKEND_URL` only when the backend is not served from the same origin.
No secret should be exposed through Vite/browser variables.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Investigation workspace with chat, streaming status, citations, recommendations, evidence and MCP trace |
| `/mcp` | MCP server/tool catalog view |
| `/knowledge` | Unstructured data source: document corpus and live retrieval preview |
| `/structured` | Structured data source: table inventory and representative data points |
| `/settings` | Runtime settings and service health |

## Backend Integration

The frontend uses `src/lib/api.ts`:

- `askCopilotStream` for `POST /api/chat/stream`,
- `searchKnowledge` for `GET /api/knowledge/search`,
- `getStructuredPreview` for `GET /api/structured/preview`,
- `knowledgePdfUrl` for document PDF links.

Recommended questions are prompt shortcuts only. They do not render saved
responses; each click submits a live request.

## UI Structure

```text
src/
├── components/
│   ├── AppShell.tsx
│   ├── investigate/
│   │   ├── ChatPanel.tsx
│   │   ├── EvidenceRail.tsx
│   │   └── TraceList.tsx
│   └── ui/
├── lib/
│   ├── api.ts
│   ├── format.ts
│   ├── theme.tsx
│   └── types.ts
├── mock/
├── pages/
└── styles/
```

## Design Notes

- The main chat stays readable; evidence and MCP trace details live in the right
  rail.
- Previous turns are shown as collapsed sections in the right rail, not inside
  chat history.
- Citation clicks open the relevant evidence text.
- Voice input uses browser speech recognition when available.
- The structured and unstructured tabs preview what each agent can access
  without becoming full admin/database tools.
