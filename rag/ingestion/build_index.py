#!/usr/bin/env python3
"""
Build the multi-representation retrieval index.

    python rag/ingestion/build_index.py [--reset]

For each document: extract its text from PDF, capture metadata, then embed
every representation defined in representations.py. All of a document's
vectors point back at the same whole document — the document is never split.

The stored payload keeps the full document text and a section/page map, so a
retrieval hit can be turned into a precise citation locator without the index
itself being section-granular.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import chromadb
import pdfplumber
from chromadb.config import Settings
from dotenv import load_dotenv
from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from corpus_content import CORPUS, output_path  # noqa: E402
from representations import flatten  # noqa: E402

EMBED_MODEL = "text-embedding-3-small"
COLLECTION = "alarm_documents"
INDEX_DIR = ROOT / "rag" / "index"
DOCS_DIR = ROOT / "rag" / "documents"

def extract(pdf_path: Path, spec: dict) -> tuple[str, list[dict]]:
    """
    Full text plus a section -> page map used to build citation locators.

    Headings are located rather than parsed: the authoritative section numbers
    and titles come from the content module that generated the PDF, so a
    heading is only recorded once it is confirmed present on a page. Regex
    sniffing of extracted lines was tried first and is unreliable — reportlab's
    non-breaking spaces collapse to single spaces, making headings
    indistinguishable from table rows such as "1 to 2 Routine ...".
    """
    with pdfplumber.open(pdf_path) as pdf:
        pages = [(page.extract_text() or "") for page in pdf.pages]

    # Normalise whitespace once per page for matching.
    flat = [re.sub(r"\s+", " ", p) for p in pages]

    sections: list[dict] = []
    for block in spec["blocks"]:
        if block[0] not in ("h1", "h2"):
            continue
        number, title = block[1], block[2]
        needle = re.sub(r"\s+", " ", f"{number} {title}")
        page_no = next((i for i, p in enumerate(flat, start=1) if needle in p), None)
        if page_no is None:
            raise ValueError(f"{spec['doc_id']}: heading {number} {title!r} not found in extracted text")
        sections.append({"number": number, "title": title, "page": page_no})

    return "\n".join(pages), sections


def embed_all(client: OpenAI, texts: list[str], batch: int = 96) -> list[list[float]]:
    vectors: list[list[float]] = []
    for i in range(0, len(texts), batch):
        resp = client.embeddings.create(model=EMBED_MODEL, input=texts[i:i + batch])
        vectors.extend(d.embedding for d in resp.data)
    return vectors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="Drop the collection before building")
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set. Add it to .env at the repository root.", file=sys.stderr)
        return 1

    openai_client = OpenAI()
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    chroma = chromadb.PersistentClient(path=str(INDEX_DIR), settings=Settings(anonymized_telemetry=False))

    if args.reset:
        try:
            chroma.delete_collection(COLLECTION)
            print(f"Dropped existing collection '{COLLECTION}'.")
        except Exception:
            pass

    collection = chroma.get_or_create_collection(name=COLLECTION, metadata={"hnsw:space": "cosine"})

    # --- documents -------------------------------------------------------
    specs = {s["doc_id"]: s for s in CORPUS}
    docs: dict[str, dict] = {}
    print("Extracting documents")
    for doc_id, spec in specs.items():
        path = DOCS_DIR / output_path(spec)
        text, sections = extract(path, spec)
        docs[doc_id] = {"spec": spec, "text": text, "sections": sections, "path": path}
        print(f"  {doc_id:<9} {len(text):>6} chars  {len(sections):>2} sections  {path.parent.name}/")

    # --- representations -------------------------------------------------
    reps = flatten()
    print(f"\nEmbedding {len(reps)} representations across {len(docs)} documents "
          f"({EMBED_MODEL})")
    vectors = embed_all(openai_client, [r["text"] for r in reps])

    ids, metadatas, documents = [], [], []
    for rep, _vec in zip(reps, vectors):
        d = docs[rep["doc_id"]]
        spec = d["spec"]
        ids.append(rep["rep_id"])
        # Chroma metadata values must be scalars.
        metadatas.append({
            "doc_id": rep["doc_id"],
            "rep_kind": rep["rep_kind"],
            "title": spec["title"],
            "kind": spec["kind"],
            "revision": spec["revision"],
            "site": spec["site"],
            "unit": spec["unit"],
            "asset_class": spec["asset_class"],
            "tags": ", ".join(spec["tags"]),
            "source_path": str(d["path"].relative_to(ROOT)),
            "sections": "; ".join(f"{s['number']}|{s['title']}|p{s['page']}" for s in d["sections"]),
            "doc_text": d["text"],
            "is_injection_fixture": bool(spec.get("is_injection_fixture")),
        })
        # The embedded string is the representation; the payload is the whole doc.
        documents.append(rep["text"])

    collection.upsert(ids=ids, embeddings=vectors, metadatas=metadatas, documents=documents)

    print(f"\nIndexed {collection.count()} vectors -> {len(docs)} documents at "
          f"{INDEX_DIR.relative_to(ROOT)}/")
    by_doc: dict[str, int] = {}
    for r in reps:
        by_doc[r["doc_id"]] = by_doc.get(r["doc_id"], 0) + 1
    print("\n  vectors per document")
    for doc_id, n in sorted(by_doc.items()):
        print(f"    {doc_id:<9} {n:>2}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
