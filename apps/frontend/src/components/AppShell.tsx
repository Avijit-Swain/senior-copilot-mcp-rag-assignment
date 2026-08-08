import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  BookOpen,
  Moon,
  MessageSquareText,
  Settings2,
  Sun,
  Wrench,
} from 'lucide-react'
import { AbbLogo } from './AbbLogo'
import { StatusDot } from './ui/primitives'
import { useTheme } from '../lib/theme'
import { MCP_SERVERS, MCP_TOOLS } from '../mock/servers'
import { CORPUS } from '../mock/corpus'
import { TRACES } from '../mock/conversation'

const NAV = [
  { to: '/', label: 'Investigate', icon: MessageSquareText, end: true, count: null },
  { to: '/mcp', label: 'MCP Tools', icon: Wrench, end: false, count: MCP_TOOLS.length },
  { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen, end: false, count: CORPUS.length },
  { to: '/traces', label: 'Traces', icon: Activity, end: false, count: TRACES.length },
  { to: '/settings', label: 'Settings', icon: Settings2, end: false, count: null },
] as const

const TITLES: Record<string, { title: string; sub: string }> = {
  '/': {
    title: 'Alarm Investigation',
    sub: 'Ask in natural language — the copilot chains MCP tools and cites site documentation',
  },
  '/mcp': { title: 'MCP Tool Catalog', sub: 'Tools discovered from the connected MCP servers' },
  '/knowledge': { title: 'Knowledge Base', sub: 'Document corpus, ingestion status and retrieval preview' },
  '/traces': { title: 'Execution Traces', sub: 'Per-request observability across MCP, retrieval and the LLM' },
  '/settings': { title: 'Settings', sub: 'Runtime configuration and service health' },
}

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const heading = TITLES[pathname] ?? TITLES['/']
  const allOk = MCP_SERVERS.every((s) => s.status === 'ok')

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar__brand">
          <AbbLogo height={16} />
          <span className="sidebar__brand-text">
            <span className="sidebar__brand-title">Alarm Copilot</span>
            <span className="sidebar__brand-sub">Procedure Guidance</span>
          </span>
        </div>

        <div className="sidebar__nav">
          <div className="sidebar__label">Workspace</div>
          {NAV.map(({ to, label, icon: Icon, end, count }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `navitem${isActive ? ' is-active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
              {count !== null && <span className="navitem__count">{count}</span>}
            </NavLink>
          ))}
        </div>

        <div className="sidebar__foot">
          {MCP_SERVERS.map((s) => (
            <div key={s.id} className="envline">
              <StatusDot status={s.status} pulse={s.status !== 'ok'} />
              <span className="truncate">{s.name}</span>
            </div>
          ))}
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <div className="topbar__heading">
            <div className="topbar__title">{heading.title}</div>
            <div className="topbar__sub truncate">{heading.sub}</div>
          </div>
          <div className="topbar__actions">
            <span className="chip">
              <StatusDot status={allOk ? 'ok' : 'degraded'} pulse={!allOk} />
              {allOk ? 'All services healthy' : 'Degraded'}
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
