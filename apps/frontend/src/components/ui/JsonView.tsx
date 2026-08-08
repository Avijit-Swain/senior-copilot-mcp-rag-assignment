import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

/**
 * Read-only JSON inspector with syntax highlighting.
 *
 * Highlighting is done by escaping the serialised string first and then
 * wrapping tokens, so document content can never inject markup here.
 */

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlight(json: string) {
  return escapeHtml(json).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'n'
      if (match.startsWith('"')) cls = match.endsWith(':') ? 'k' : 's'
      else if (/true|false|null/.test(match)) cls = 'b'
      return `<span class="${cls}">${match}</span>`
    },
  )
}

export function JsonView({ value, label }: { value: unknown; label?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const text = value === undefined ? 'undefined' : JSON.stringify(value, null, 2)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable — non-critical */
    }
  }

  return (
    <div>
      <div className="iolabel">
        {label}
        <button type="button" className="btn btn--ghost btn--sm spacer" onClick={copy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="json" dangerouslySetInnerHTML={{ __html: highlight(text) }} />
    </div>
  )
}
