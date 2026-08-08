import { useState } from 'react'
import { ChevronRight, RotateCcw, Server } from 'lucide-react'
import type { McpToolCall } from '../../lib/types'
import { JsonView } from '../ui/JsonView'
import { Badge, ErrorBox, ToolStatusBadge } from '../ui/primitives'
import { ms } from '../../lib/format'

/**
 * Expandable MCP execution trace.
 *
 * Each row shows the tool, outcome, attempt count and duration; expanding it
 * reveals the exact request and response that crossed the MCP boundary.
 */
export function TraceList({ calls }: { calls: McpToolCall[] }) {
  const slowest = Math.max(1, ...calls.map((c) => c.durationMs))

  return (
    <div className="trace">
      {calls.map((call) => (
        <TraceRow key={call.id} call={call} slowest={slowest} />
      ))}
    </div>
  )
}

function TraceRow({ call, slowest }: { call: McpToolCall; slowest: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="tracecall">
      <button type="button" className="tracecall__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ChevronRight size={13} className={`chev${open ? ' is-open' : ''}`} />
        <span className="tracecall__idx">{call.index}</span>
        <span style={{ minWidth: 0 }}>
          <div className="tracecall__name truncate">{call.toolName}</div>
          <div className="tracecall__server">{call.serverId}</div>
        </span>
        <span className="tracecall__right">
          {call.attempts > 1 && (
            <Badge tone="warn">
              <RotateCcw size={9} />
              {call.attempts - 1} retry
            </Badge>
          )}
          {call.httpStatus !== null && <span className="tracecall__dur">{call.httpStatus}</span>}
          <span className="tracecall__dur">{ms(call.durationMs)}</span>
          <ToolStatusBadge status={call.status} />
        </span>
      </button>

      <div className="tracecall__bar">
        <div
          className="tracecall__bar-fill"
          style={{ width: `${Math.max(2, (call.durationMs / slowest) * 100)}%` }}
        />
      </div>

      {open && (
        <div className="tracecall__body">
          {call.error && (
            <ErrorBox
              title={call.error.code}
              body={call.error.message}
              action={
                <button type="button" className="btn btn--sm">
                  <RotateCcw size={12} />
                  Retry
                </button>
              }
            />
          )}
          <JsonView
            value={call.request}
            label={
              <>
                <Server size={11} />
                Request
              </>
            }
          />
          <JsonView value={call.response} label="Response" />
        </div>
      )}
    </div>
  )
}
