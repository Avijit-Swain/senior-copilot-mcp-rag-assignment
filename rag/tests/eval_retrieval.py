#!/usr/bin/env python3
"""
Retrieval evaluation for the multi-representation index.

    python rag/tests/eval_retrieval.py

Because several vectors resolve to the same document, the raw vector hits are
deduplicated by document (keeping each document's best-scoring representation)
before top-k is applied. TOP_K is therefore a count of distinct documents, not
of vectors.

The question set deliberately includes queries the corpus cannot answer. Those
must fall below SCORE_FLOOR so low-confidence handling can be exercised
honestly rather than by returning a weak match.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv
from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "rag" / "retrieval"))
from relevance_gate import gate  # noqa: E402

EMBED_MODEL = "text-embedding-3-small"
COLLECTION = "alarm_documents"
TOP_K = 3
SCORE_FLOOR = 0.35          # cosine similarity below this counts as no match
OVERFETCH = 20              # vectors pulled before dedup to documents

# (question, expected_doc_id or None for "corpus cannot answer this")
QUESTIONS: list[tuple[str, str | None]] = [
    ("What should I check first when Boiler Feed Pump 101 shows low suction pressure?", "SOP-114"),
    ("At what strainer differential pressure should I change over?", "SOP-114"),
    ("How many times must an alarm recur before I escalate it to maintenance?", "SOP-114"),
    ("Investigate recurring high-severity alarms for Boiler Feed Pump 101 over the last 90 days", "SOP-114"),

    ("Can we keep the pump running with increased monitoring instead of inspecting it?", "MM-207"),
    ("When must a pump be removed from service?", "MM-207"),
    ("What are the bearing clearance and seal face wear limits after inspection?", "MM-207"),

    ("Why do low suction pressure and high bearing temperature alarms occur together?", "TG-051"),
    ("How do I calculate available NPSH against required NPSH?", "TG-051"),

    ("Do I need to isolate the pump before inspecting the bearings?", "SI-009"),
    ("Can I inspect equipment while running if the advisory system says it is safe?", "SI-009"),

    ("How is alarm priority decided, and which alarm is the highest priority?", "AP-001"),
    ("What counts as an alarm flood?", "AP-001"),
    ("When is an alarm a candidate for rationalisation?", "AP-001"),

    ("What related assets should be inspected for this motor trip alarm?", "TG-088"),
    ("Why are compressor discharge pressure alarms repeatedly occurring?", "SOP-220"),
    ("Alarms keep coming back even after we changed over the strainer", "KB-3312"),

    ("What is the procedure for a flare header high pressure alarm?", None),
    ("How do I test transformer insulation resistance?", None),
    ("What is the maintenance schedule for the plate heat exchanger?", None),
]


def retrieve(collection, client: OpenAI, question: str, k: int = TOP_K) -> list[dict]:
    vec = client.embeddings.create(model=EMBED_MODEL, input=question).data[0].embedding
    res = collection.query(
        query_embeddings=[vec],
        n_results=OVERFETCH,
        include=["metadatas", "documents", "distances"],
    )

    best: dict[str, dict] = {}
    for rep_text, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        score = 1.0 - dist                      # chroma cosine distance -> similarity
        doc_id = meta["doc_id"]
        if doc_id not in best or score > best[doc_id]["score"]:
            best[doc_id] = {
                "doc_id": doc_id,
                "score": score,
                "title": meta["title"],
                "kind": meta["kind"],
                "rep_kind": meta["rep_kind"],
                "matched_on": rep_text,
                "doc_text": meta["doc_text"],
            }
    return sorted(best.values(), key=lambda h: -h["score"])[:k]


def main() -> int:
    load_dotenv(ROOT / ".env")
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set.", file=sys.stderr)
        return 1

    client = OpenAI()
    chroma = chromadb.PersistentClient(
        path=str(ROOT / "rag" / "index"), settings=Settings(anonymized_telemetry=False)
    )
    collection = chroma.get_collection(COLLECTION)

    answerable = [q for q in QUESTIONS if q[1]]
    unanswerable = [q for q in QUESTIONS if not q[1]]

    print(f"Multi-representation retrieval — {collection.count()} vectors, TOP_K={TOP_K} documents\n")
    print("=" * 100)
    print("ANSWERABLE QUESTIONS")
    print("=" * 100)
    print(f"{'':<2} {'RANK':<5} {'TOP-3 DOCUMENTS (score)':<58} {'EXPECT':<9} RESULT")
    print("-" * 100)

    at1 = at3 = 0
    for question, expected in answerable:
        hits = retrieve(collection, client, question)
        ranked = [h["doc_id"] for h in hits]
        rank = ranked.index(expected) + 1 if expected in ranked else None
        if rank == 1:
            at1 += 1
        if rank:
            at3 += 1
        mark = "PASS" if rank == 1 else ("ok@%d" % rank if rank else "MISS")
        summary = "  ".join(f"{h['doc_id']}({h['score']:.2f})" for h in hits)
        print(f"{'✓' if rank == 1 else ('~' if rank else '✗'):<2} {str(rank or '-'):<5} {summary:<58} {expected:<9} {mark}")
        if rank != 1:
            print(f"     └ q: {question}")

    n = len(answerable)
    print("-" * 100)
    print(f"precision@1 = {at1}/{n} ({at1/n:.0%})     recall@{TOP_K} = {at3}/{n} ({at3/n:.0%})")

    print("\n" + "=" * 100)
    print("RELEVANCE GATE — vector scores cannot separate answerable from unanswerable")
    print("(measured overlap: answerable top-1 0.53-0.85, unanswerable 0.45-0.59)")
    print("=" * 100)
    print(f"{'':<2} {'TOP1':>5}  {'VECTOR TOP-3':<34} {'SURVIVES GATE':<22} EXPECTED")
    print("-" * 100)

    gate_ok = 0
    for question, expected in QUESTIONS:
        hits = retrieve(collection, client, question)
        kept = gate(client, question, hits)
        kept_ids = [h["doc_id"] for h in kept]

        if expected:
            correct = expected in kept_ids
        else:
            correct = not kept_ids
        gate_ok += correct

        print(f"{'✓' if correct else '✗':<2} {hits[0]['score']:>5.2f}  "
              f"{' '.join(h['doc_id'] for h in hits):<34} "
              f"{(' '.join(kept_ids) or '(none — low confidence)'):<22} "
              f"{expected or 'NONE'}")
        if not correct:
            print(f"     └ q: {question}")

    print("-" * 100)
    print(f"gate correct = {gate_ok}/{len(QUESTIONS)} ({gate_ok/len(QUESTIONS):.0%})")

    return 0 if (at3 == n and gate_ok == len(QUESTIONS)) else 2


if __name__ == "__main__":
    raise SystemExit(main())
