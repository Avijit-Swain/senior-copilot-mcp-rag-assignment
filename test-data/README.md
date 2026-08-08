# Test data

The Alarm Management API simulator database is generated here by:

```bash
.venv/bin/python scripts/init_alarm_db.py --reset
```

The SQLite file is intentionally ignored; `connectors/alarm_api/schema.sql` and `connectors/alarm_api/seed.sql` are the source of truth.
