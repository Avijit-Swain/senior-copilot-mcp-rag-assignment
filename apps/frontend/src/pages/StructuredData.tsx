import { useEffect, useMemo, useState } from 'react'
import { Database, RefreshCw } from 'lucide-react'
import type { StructuredPreviewResponse, StructuredTablePreview } from '../lib/types'
import { getStructuredPreview } from '../lib/api'
import { Badge, Card, EmptyState, ErrorBox, SkeletonBlock, StatTile } from '../components/ui/primitives'

function cellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function tableFamily(name: string): string {
  if (name.includes('alarm')) return 'alarm operations'
  if (name.includes('asset') || name === 'sites' || name === 'units') return 'asset hierarchy'
  if (name.includes('recommendation') || name.includes('priority')) return 'decision support'
  if (name.includes('kpi') || name.includes('calculation')) return 'analytics'
  if (name.includes('trace')) return 'observability'
  return 'structured'
}

function importantColumns(table: StructuredTablePreview): string[] {
  const preferred = table.columns.filter((column) =>
    /(^.*_id$|name|asset|alarm|severity|status|priority|score|urgency|endpoint|method|created|time)/i.test(column),
  )
  return (preferred.length ? preferred : table.columns).slice(0, 7)
}

function findTable(data: StructuredPreviewResponse, name: string): StructuredTablePreview | undefined {
  return data.tables.find((table) => table.name === name)
}

function valueAt(row: Record<string, unknown> | undefined, key: string): string {
  return cellValue(row?.[key])
}

export function StructuredData() {
  const [data, setData] = useState<StructuredPreviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      setData(await getStructuredPreview(5, signal))
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Structured preview failed.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])

  const totalRows = useMemo(
    () => data?.tables.reduce((sum, table) => sum + table.rowCount, 0) ?? 0,
    [data],
  )
  const totalColumns = useMemo(
    () => data?.tables.reduce((sum, table) => sum + table.columns.length, 0) ?? 0,
    [data],
  )
  const businessTables = useMemo(
    () => data?.tables.filter((table) => table.name !== 'api_trace_events').length ?? 0,
    [data],
  )
  const assets = data ? findTable(data, 'assets')?.sampleRows.slice(0, 3) ?? [] : []
  const alarms = data ? findTable(data, 'alarms')?.sampleRows.slice(0, 3) ?? [] : []
  const priorities = data ? findTable(data, 'priority_scores')?.sampleRows.slice(0, 3) ?? [] : []
  const recommendations = data ? findTable(data, 'operator_recommendations')?.sampleRows.slice(0, 3) ?? [] : []

  return (
    <div className="page page--scroll">
      <div className="page__inner">
        <div className="page__head">
          <div>
            <h2>Structured data source</h2>
            <p>
              Tabular alarm-management data exposed through the Alarm Management API simulator
              and invoked by the structured MCP agent for asset resolution, alarm summaries,
              priority scoring, correlations and operator recommendations.
            </p>
          </div>
          <div className="page__head-actions">
            <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={14} />
              Refresh preview
            </button>
          </div>
        </div>

        {loading && !data ? (
          <Card>
            <SkeletonBlock lines={6} />
          </Card>
        ) : error ? (
          <Card>
            <ErrorBox title="Structured preview failed" body={error} />
          </Card>
        ) : !data ? (
          <Card>
            <EmptyState
              icon={<Database size={20} />}
              title="No structured data available"
              body="The backend did not return a structured data preview."
            />
          </Card>
        ) : (
          <>
            <div className="stats">
              <StatTile label="Tables" value={data.tables.length} hint={`${businessTables} business tables`} />
              <StatTile label="Rows" value={totalRows} hint="including API traces" />
              <StatTile label="Columns" value={totalColumns} hint="SQLite schema fields" />
              <StatTile label="Source" value="SQLite" hint={data.source} />
            </div>

            <Card
              title="Available tables"
              icon={<Database size={13} />}
              actions={<Badge tone="ok">live preview</Badge>}
              flush
            >
              <div className="table__scroll">
                <table className="table structured-inventory">
                  <thead>
                    <tr>
                      <th>Table</th>
                      <th>Info</th>
                      <th>Rows</th>
                      <th>Key fields</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tables.map((table) => (
                      <tr key={table.name}>
                        <td>
                          <div className="structured-table-name">{table.title}</div>
                          <div className="mono subtle">{table.name}</div>
                        </td>
                        <td>{table.description}</td>
                        <td className="num">{table.rowCount}</td>
                        <td>
                          <span className="row row--wrap">
                            <Badge tone="neutral">{tableFamily(table.name)}</Badge>
                            {importantColumns(table).slice(0, 4).map((column) => (
                              <Badge tone="neutral" key={column}>{column}</Badge>
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="structured-examples-head">
              <h3>Examples</h3>
              <p>A few representative rows the structured agent can use during an investigation.</p>
            </div>

            <div className="structured-points">
              <Card title="Asset data points">
                <div className="structured-point-list">
                  {assets.map((row) => (
                    <div className="structured-point" key={valueAt(row, 'asset_id')}>
                      <strong>{valueAt(row, 'asset_id')}</strong>
                      <span>{valueAt(row, 'asset_name')}</span>
                      <small>{valueAt(row, 'site')} · {valueAt(row, 'unit')} · {valueAt(row, 'status')}</small>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Alarm data points">
                <div className="structured-point-list">
                  {alarms.map((row) => (
                    <div className="structured-point" key={valueAt(row, 'alarm_id')}>
                      <strong>{valueAt(row, 'alarm_name')}</strong>
                      <span>{valueAt(row, 'asset_id')} · {valueAt(row, 'severity')} · {valueAt(row, 'status')}</span>
                      <small>{valueAt(row, 'probable_cause')}</small>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Priority data points">
                <div className="structured-point-list">
                  {priorities.map((row) => (
                    <div className="structured-point" key={valueAt(row, 'alarm_id')}>
                      <strong>{valueAt(row, 'alarm_id')}</strong>
                      <span>score {valueAt(row, 'score')} · {valueAt(row, 'priority_band')}</span>
                      <small>{valueAt(row, 'computed_at')}</small>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Recommendation data points">
                <div className="structured-point-list">
                  {recommendations.map((row) => (
                    <div className="structured-point" key={`${valueAt(row, 'alarm_id')}-${valueAt(row, 'rank')}`}>
                      <strong>{valueAt(row, 'alarm_id')}</strong>
                      <span>{valueAt(row, 'urgency')} · rank {valueAt(row, 'rank')}</span>
                      <small>{valueAt(row, 'action_text')}</small>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
