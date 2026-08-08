#!/usr/bin/env python3
"""Initialize the local Alarm Management API simulator SQLite database."""
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "test-data" / "alarm_management.sqlite3"
SCHEMA = ROOT / "connectors" / "alarm_api" / "schema.sql"
SEED = ROOT / "connectors" / "alarm_api" / "seed.sql"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    args.db.parent.mkdir(parents=True, exist_ok=True)
    if args.reset and args.db.exists():
        args.db.unlink()

    with sqlite3.connect(args.db) as conn:
        conn.executescript(SCHEMA.read_text())
        conn.executescript(SEED.read_text())
        conn.execute("PRAGMA foreign_key_check")

    print(f"initialized {args.db}")


if __name__ == "__main__":
    main()
