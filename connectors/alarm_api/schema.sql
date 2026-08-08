-- Alarm Management API simulator relational schema.
-- SQLite is used for the local assignment simulator; constraints mirror the
-- structured data contract exposed later through the API and MCP server.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sites (
    site_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    region TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC'
);

CREATE TABLE IF NOT EXISTS units (
    unit_id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    process_area TEXT NOT NULL,
    UNIQUE(site_id, name)
);

CREATE TABLE IF NOT EXISTS assets (
    asset_id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL REFERENCES units(unit_id) ON DELETE CASCADE,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    tag TEXT NOT NULL UNIQUE,
    manufacturer TEXT,
    model TEXT,
    criticality TEXT NOT NULL CHECK (criticality IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL CHECK (status IN ('running', 'standby', 'maintenance', 'offline')),
    commissioned_at TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(asset_name);
CREATE INDEX IF NOT EXISTS idx_assets_unit ON assets(unit_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);

CREATE TABLE IF NOT EXISTS asset_relationships (
    relationship_id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    target_asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('upstream', 'downstream', 'drives', 'driven_by', 'instrumented_by', 'protects', 'related')),
    description TEXT,
    UNIQUE(source_asset_id, target_asset_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS alarms (
    alarm_id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    alarm_name TEXT NOT NULL,
    alarm_type TEXT NOT NULL CHECK (alarm_type IN ('safety', 'device')),
    severity TEXT NOT NULL CHECK (severity IN ('medium', 'high', 'critical')),
    status TEXT NOT NULL CHECK (status IN ('active', 'acknowledged', 'cleared', 'shelved')),
    start_time TEXT NOT NULL,
    end_time TEXT,
    acknowledged_at TEXT,
    ack_delay_seconds INTEGER,
    message TEXT NOT NULL,
    probable_cause TEXT,
    process_value REAL,
    process_value_unit TEXT,
    setpoint REAL,
    alarm_limit REAL,
    metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_alarms_asset_time ON alarms(asset_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_alarms_status ON alarms(status);
CREATE INDEX IF NOT EXISTS idx_alarms_severity ON alarms(severity);
CREATE INDEX IF NOT EXISTS idx_alarms_name ON alarms(alarm_name);

CREATE TABLE IF NOT EXISTS alarm_occurrences (
    occurrence_id TEXT PRIMARY KEY,
    alarm_id TEXT NOT NULL REFERENCES alarms(alarm_id) ON DELETE CASCADE,
    occurred_at TEXT NOT NULL,
    cleared_at TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('medium', 'high', 'critical')),
    ack_delay_seconds INTEGER,
    operator_id TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_occurrences_alarm_time ON alarm_occurrences(alarm_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS alarm_correlations (
    correlation_id TEXT PRIMARY KEY,
    primary_alarm_id TEXT NOT NULL REFERENCES alarms(alarm_id) ON DELETE CASCADE,
    related_alarm_id TEXT NOT NULL REFERENCES alarms(alarm_id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    support_count INTEGER NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    lag_minutes INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    UNIQUE(primary_alarm_id, related_alarm_id, method)
);

CREATE TABLE IF NOT EXISTS priority_scores (
    score_id TEXT PRIMARY KEY,
    alarm_id TEXT NOT NULL REFERENCES alarms(alarm_id) ON DELETE CASCADE,
    score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
    priority_band TEXT NOT NULL CHECK (priority_band IN ('low', 'medium', 'high', 'urgent')),
    factors_json TEXT NOT NULL,
    computed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operator_recommendations (
    recommendation_id TEXT PRIMARY KEY,
    alarm_id TEXT NOT NULL REFERENCES alarms(alarm_id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    rationale TEXT NOT NULL,
    urgency TEXT NOT NULL CHECK (urgency IN ('routine', 'soon', 'immediate')),
    source TEXT NOT NULL CHECK (source IN ('api_rule', 'engineering_rule', 'historical_pattern')),
    rank INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recommendations_alarm_rank ON operator_recommendations(alarm_id, rank);

CREATE TABLE IF NOT EXISTS kpi_definitions (
    kpi_name TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL,
    unit TEXT NOT NULL,
    formula TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calculation_templates (
    calculation_type TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL,
    safe_formula TEXT NOT NULL,
    output_schema_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generated_calculations (
    calculation_id TEXT PRIMARY KEY,
    calculation_type TEXT NOT NULL REFERENCES calculation_templates(calculation_type),
    request_json TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('generated', 'executed', 'failed')) DEFAULT 'generated'
);

CREATE TABLE IF NOT EXISTS api_trace_events (
    trace_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    client_id TEXT,
    metadata_tag TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms INTEGER,
    request_json TEXT,
    response_json TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_trace_events_trace_id ON api_trace_events(trace_id);
