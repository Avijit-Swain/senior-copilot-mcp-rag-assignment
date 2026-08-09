# Connectors

Connector source files live here. For this assignment, the structured connector
is the Alarm Management API simulator backed by SQLite.

| Path | Purpose |
| --- | --- |
| `alarm_api/schema.sql` | Database schema for the simulator |
| `alarm_api/seed.sql` | Deterministic seed data used by tests and demos |

The generated SQLite database is written to `test-data/` and is intentionally
ignored by Git.
