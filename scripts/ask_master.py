#!/usr/bin/env python3
"""Run the master orchestrator against a question."""
from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "mcp-servers" / "alarm-management"))

from apps.backend.agent.master_graph import ask_master  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: scripts/ask_master.py '<question>'")
        return 1
    state = ask_master(" ".join(sys.argv[1:]))
    print(state.get("final_answer", ""))
    print("\nMCP TRACE")
    for call in state.get("mcp_trace", []):
        result = call.get("result", {})
        trace = result.get("trace", {})
        print(f"- {call.get('name')} status={trace.get('status_code')} attempts={trace.get('attempts')}")
    print("\nCITATIONS")
    for c in state.get("citations", []):
        print(f"- {c.get('doc_id')} §{c.get('section')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
