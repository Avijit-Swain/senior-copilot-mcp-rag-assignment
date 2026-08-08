import { useMemo, useState } from 'react'
import {
  ChevronRight,
  Clock,
  KeyRound,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Wrench,
} from 'lucide-react'
import type { McpTool, McpToolParam } from '../lib/types'
import { MCP_SERVERS, MCP_TOOLS } from '../mock/servers'
import { Badge, Card, EmptyState, StatusDot } from '../components/ui/primitives'
import { JsonView } from '../components/ui/JsonView'
import { ms } from '../lib/format'

/* --------------------------------------------------------------------------
   MCP tool discovery view.

   Placeholder: the catalog is static. Wiring this up means replacing
   MCP_TOOLS with the result of an MCP `tools/list` call.
   -------------------------------------------------------------------------- */

export function McpTools() {
  const [query, setQuery] = useState('')
  const [server, setServer] = useState<string>('all')

  const tools = useMemo(
    () =>
      MCP_TOOLS.filter((t) => (server === 'all' ? true : t.serverId === server)).filter((t) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return (
          t.name.includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.operation.toLowerCase().includes(q)
        )
      }),
    [query, server],
  )

  return (
    <div className="page page--scroll">
      <div className="page__inner">
        <div className="page__head">
          <div>
            <h2>Connected servers</h2>
            <p>
              Tools below were discovered over MCP. The copilot never calls the Alarm Management API
              directly — every source-system read goes through one of these servers.
            </p>
          </div>
          <div className="page__head-actions">
            <button type="button" className="btn">
              <RefreshCw size={14} />
              Re-discover
            </button>
          </div>
        </div>

        <div className="stats">
          {MCP_SERVERS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="stat"
              style={{
                textAlign: 'left',
                borderColor: server === s.id ? 'var(--accent)' : undefined,
              }}
              onClick={() => setServer((cur) => (cur === s.id ? 'all' : s.id))}
            >
              <div className="row">
                <StatusDot status={s.status} pulse={s.status !== 'ok'} />
                <span className="stat__label" style={{ letterSpacing: 0 }}>
                  {s.name}
                </span>
              </div>
              <div className="stat__value" style={{ fontSize: 'var(--text-lg)' }}>
                {s.toolCount} tools
              </div>
              <div className="stat__hint mono">
                {s.transport} · {s.url}
              </div>
              <div className="stat__hint mono">
                protocol {s.protocolVersion} · {s.latencyMs !== null ? ms(s.latencyMs) : '—'}
              </div>
            </button>
          ))}
        </div>

        <div className="row row--wrap">
          <label className="searchbox" style={{ flex: 1, minWidth: 220 }}>
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tools by name, description or operation…"
              aria-label="Filter tools"
            />
          </label>
          <Badge tone="neutral">
            {tools.length} of {MCP_TOOLS.length}
          </Badge>
          {server !== 'all' && (
            <button type="button" className="btn btn--sm" onClick={() => setServer('all')}>
              Clear server filter
            </button>
          )}
        </div>

        {tools.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Wrench size={20} />}
              title="No tools match that filter"
              body="Try a different keyword, or clear the server filter."
            />
          </Card>
        ) : (
          <div className="col" style={{ gap: 'var(--sp-3)' }}>
            {tools.map((t) => (
              <ToolCard key={`${t.serverId}.${t.name}`} tool={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCard({ tool }: { tool: McpTool }) {
  const [open, setOpen] = useState(false)
  const isWrite = tool.authScope.endsWith(':write')

  return (
    <article className="toolcard">
      <button type="button" className="toolcard__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ChevronRight size={14} className={`chev${open ? ' is-open' : ''}`} style={{ marginTop: 9 }} />
        <span className="toolcard__icon">
          <Wrench size={15} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="row">
            <span className="toolcard__name">{tool.name}</span>
            {isWrite && (
              <Badge tone="warn">
                <ShieldAlert size={9} />
                write · confirmation required
              </Badge>
            )}
          </span>
          <p className="toolcard__desc">{tool.description}</p>
          <span className="toolcard__tags">
            <Badge tone="neutral">
              <Server size={9} />
              {tool.operation}
            </Badge>
            <Badge tone="neutral">
              <Clock size={9} />
              {ms(tool.timeoutMs)} timeout
            </Badge>
            <Badge tone="neutral">
              <RefreshCw size={9} />
              {tool.retries} retries
            </Badge>
            <Badge tone="neutral">
              <KeyRound size={9} />
              {tool.authScope}
            </Badge>
          </span>
        </span>
      </button>

      {open && (
        <div className="toolcard__body">
          <div className="schema-grid">
            <SchemaTable title="Input schema" params={tool.input} />
            <SchemaTable title="Output schema" params={tool.output} />
          </div>

          <div>
            <div className="iolabel">Error mapping</div>
            <div className="table__scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>MCP error code</th>
                    <th>Raised when</th>
                  </tr>
                </thead>
                <tbody>
                  {tool.errorCodes.map((e) => (
                    <tr key={e.code}>
                      <td className="mono">{e.code}</td>
                      <td className="muted">{e.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="schema-grid">
            <JsonView label="Example invocation" value={tool.exampleInput} />
            <JsonView label="Example response" value={tool.exampleOutput} />
          </div>

          <div className="row">
            <button type="button" className="btn btn--primary btn--sm" disabled>
              <Play size={12} />
              Run tool
            </button>
            <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
              Enabled once the MCP client is connected
            </span>
          </div>
        </div>
      )}
    </article>
  )
}

function SchemaTable({ title, params }: { title: string; params: McpToolParam[] }) {
  return (
    <div>
      <div className="iolabel">{title}</div>
      {params.length === 0 ? (
        <p className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
          No parameters.
        </p>
      ) : (
        <div className="table__scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Req.</th>
              </tr>
            </thead>
            <tbody>
              {params.map((p) => (
                <tr key={p.name}>
                  <td>
                    <div className="mono">{p.name}</div>
                    <div className="subtle" style={{ fontSize: 'var(--text-2xs)' }}>
                      {p.description}
                    </div>
                  </td>
                  <td className="mono muted" style={{ whiteSpace: 'nowrap' }}>
                    {p.type}
                  </td>
                  <td>{p.required ? <Badge tone="err">yes</Badge> : <span className="subtle">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
