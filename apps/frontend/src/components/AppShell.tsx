import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Database,
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

const NAV = [
  { to: '/', label: 'Investigate', icon: MessageSquareText, end: true, count: null },
  { to: '/mcp', label: 'MCP Tools', icon: Wrench, end: false, count: MCP_TOOLS.length },
  { to: '/knowledge', label: 'Unstructured Data', icon: BookOpen, end: false, count: CORPUS.length },
  { to: '/structured', label: 'Structured Data', icon: Database, end: false, count: 13 },
  { to: '/settings', label: 'Settings', icon: Settings2, end: false, count: null },
] as const

const TITLES: Record<string, { title: string; sub: string }> = {
  '/': {
    title: 'Alarm Investigation',
    sub: 'Ask in natural language — the copilot chains MCP tools and cites site documentation',
  },
  '/mcp': { title: 'MCP Tool Catalog', sub: 'Repository MCP server and runtime-discovered tool contracts' },
  '/knowledge': { title: 'Unstructured Data Source', sub: 'Indexed PDF corpus and representative RAG retrieval evidence' },
  '/structured': { title: 'Structured Data Source', sub: 'SQLite alarm-management tables available through the structured MCP agent' },
  '/settings': { title: 'Settings', sub: 'Runtime configuration and service health' },
}

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const heading = TITLES[pathname] ?? TITLES['/']

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar__brand">
          <AbbLogo height={24} />
          <span className="sidebar__brand-text">
            <span className="sidebar__brand-title">Alarm Copilot</span>
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
              <StatusDot status="ok" />
              MCP catalog ready
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
