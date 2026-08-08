import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Investigate } from './pages/Investigate'
import { McpTools } from './pages/McpTools'
import { KnowledgeBase } from './pages/KnowledgeBase'
import { Traces } from './pages/Traces'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Investigate />} />
        <Route path="/mcp" element={<McpTools />} />
        <Route path="/knowledge" element={<KnowledgeBase />} />
        <Route path="/traces" element={<Traces />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
