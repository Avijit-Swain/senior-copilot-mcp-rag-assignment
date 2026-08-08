"""
Vector retrieval over the multi-representation index.

A query is matched against representation vectors, but what comes back is the
WHOLE document, never the representation that matched. The representation is
only an addressing mechanism.

Because several representations resolve to the same document, the search
over-fetches vectors and then deduplicates to distinct documents, keeping each
document's best-scoring representation as its score.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import chromadb
from chromadb.config import Settings
from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]

EMBED_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
COLLECTION = "alarm_documents"
TOP_K = int(os.environ.get("RETRIEVAL_TOP_K", "3"))        # distinct documents
OVERFETCH = int(os.environ.get("RETRIEVAL_OVERFETCH", "20"))  # vectors before dedup


@dataclass
class RetrievedDocument:
    doc_id: str
    title: str
    kind: str
    revision: str
    site: str
    unit: str
    asset_class: str
    source_path: str
    sections: str
    score: float
    matched_representation: str
    text: str            # the entire document, not the representation

    def section_map(self) -> dict[str, dict]:
        """{"3.2": {"title": "Suction-Side Checks", "page": 2}, ...} from metadata."""
        out: dict[str, dict] = {}
        for entry in self.sections.split("; "):
            if not entry:
                continue
            number, title, page = entry.split("|")
            out[number] = {"title": title, "page": int(page.lstrip("p"))}
        return out

    def as_context(self) -> str:
        """Rendered for the answer prompt, delimited so content stays data."""
        return (
            f"<<<DOCUMENT {self.doc_id}>>>\n"
            f"Title: {self.title}\n"
            f"Type: {self.kind}   Revision: {self.revision}\n"
            f"Applies to: {self.site} / {self.unit} / {self.asset_class}\n"
            f"Section page map: {self.sections}\n"
            f"---\n{self.text}\n"
            f"<<<END DOCUMENT {self.doc_id}>>>"
        )


@lru_cache(maxsize=1)
def _collection():
    client = chromadb.PersistentClient(
        path=str(ROOT / "rag" / "index"), settings=Settings(anonymized_telemetry=False)
    )
    return client.get_collection(COLLECTION)


@lru_cache(maxsize=1)
def _openai() -> OpenAI:
    return OpenAI()


def search(query: str, top_k: int = TOP_K, overfetch: int = OVERFETCH) -> list[RetrievedDocument]:
    """Return up to `top_k` distinct whole documents, best match first."""
    vector = _openai().embeddings.create(model=EMBED_MODEL, input=query).data[0].embedding
    res = _collection().query(
        query_embeddings=[vector],
        n_results=overfetch,
        include=["metadatas", "documents", "distances"],
    )

    best: dict[str, RetrievedDocument] = {}
    for rep_text, meta, distance in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        score = 1.0 - distance                       # chroma cosine distance -> similarity
        doc_id = meta["doc_id"]
        if doc_id in best and best[doc_id].score >= score:
            continue
        best[doc_id] = RetrievedDocument(
            doc_id=doc_id,
            title=meta["title"],
            kind=meta["kind"],
            revision=meta["revision"],
            site=meta["site"],
            unit=meta["unit"],
            asset_class=meta["asset_class"],
            source_path=meta["source_path"],
            sections=meta["sections"],
            score=score,
            matched_representation=rep_text,
            text=meta["doc_text"],
        )

    return sorted(best.values(), key=lambda d: -d.score)[:top_k]


def catalog() -> list[dict]:
    """
    One entry per document: what it is and what it covers.

    The supervisor uses this to decompose a compound question, so it needs to
    know the corpus without reading it.
    """
    rows = _collection().get(include=["metadatas", "documents"])
    docs: dict[str, dict] = {}
    for meta, rep_text in zip(rows["metadatas"], rows["documents"]):
        entry = docs.setdefault(meta["doc_id"], {
            "doc_id": meta["doc_id"],
            "title": meta["title"],
            "kind": meta["kind"],
            "site": meta["site"],
            "unit": meta["unit"],
            "asset_class": meta["asset_class"],
            "summary": "",
            "topics": [],
        })
        if meta["rep_kind"] == "summary":
            entry["summary"] = rep_text
        elif meta["rep_kind"] == "topic":
            entry["topics"].append(rep_text)
    return sorted(docs.values(), key=lambda d: d["doc_id"])
