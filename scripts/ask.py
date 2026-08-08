#!/usr/bin/env python3
"""
Run the agent against a question and show every step.

    python scripts/ask.py "your question"
    python scripts/ask.py --demo
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT / "apps" / "backend" / "agent"))

from graph import ask  # noqa: E402

DEMO = [
    "What should I check first when Boiler Feed Pump 101 shows low suction pressure?",
    "Investigate recurring high-severity alarms for Boiler Feed Pump 101 over the last 90 days, "
    "identify likely contributing factors, and tell me the recommended actions",
    "Are the API recommendations to keep monitoring the pump consistent with the maintenance manual, "
    "and what does the safety instruction say about inspecting it while running?",
    "What is the procedure for a flare header high pressure alarm?",
]


def show(question: str) -> None:
    print("=" * 96)
    print(f"Q: {question}")
    print("=" * 96)

    state = ask(question)

    print(f"\nSUPERVISOR — {len(state['subqueries'])} sub-quer"
          f"{'y' if len(state['subqueries']) == 1 else 'ies'}")
    if state.get("plan_reason"):
        print(f"  reason: {state['plan_reason']}")
    for i, sq in enumerate(state["subqueries"], 1):
        print(f"  {i}. {sq}")

    print("\nTOOL NODES (parallel)")
    for part in sorted(state["sub_answers"], key=lambda s: s["index"]):
        docs = "  ".join(f"{d['doc_id']}({d['score']})" for d in part["documents"])
        print(f"  [{part['index'] + 1}] answered={part['answered']}   retrieved: {docs}")
        if part.get("injection_noted"):
            print(f"      injection ignored: {part['injection_noted'][:80]}")

    print("\nANSWER")
    for line in (state.get("answer") or "").splitlines():
        print(f"  {line}")

    if state.get("citations"):
        print("\nCITATIONS")
        for c in state["citations"]:
            print(f"  {c.get('doc_id')} §{c.get('section')} p.{c.get('page')} — \"{c.get('quote','')}\"")
    print()


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 1
    questions = DEMO if args[0] == "--demo" else [" ".join(args)]
    for q in questions:
        show(q)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
