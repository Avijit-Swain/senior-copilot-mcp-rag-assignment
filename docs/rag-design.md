# RAG Design

The unstructured path provides grounded document evidence for operating
procedures, maintenance manuals, troubleshooting guides, safety instructions,
alarm philosophy and knowledge articles.

## Corpus

The repository includes 8 synthetic PDFs under `rag/documents/`:

| ID | Type | Purpose |
| --- | --- | --- |
| `SOP-114` | Operating procedure | Boiler feed pump low suction pressure response |
| `SOP-220` | Operating procedure | Compressor discharge pressure high response |
| `MM-207` | Maintenance manual | Centrifugal pump maintenance and removal criteria |
| `TG-051` | Troubleshooting guide | Cavitation and NPSH diagnosis |
| `TG-088` | Troubleshooting guide | Motor trip and electrical fault investigation |
| `SI-009` | Safety instruction | Isolation of rotating equipment |
| `AP-001` | Alarm philosophy | Alarm rationalisation and priority principles |
| `KB-3312` | Knowledge article | Recurring pump alarms and prompt-injection fixture |

The documents are synthetic so they can be committed safely, but they are
structured like controlled site documentation with sections, page locators and
metadata suitable for citation.

## Ingestion

The ingestion command is:

```bash
.venv/bin/python rag/ingestion/build_index.py --reset
```

The ingestion pipeline:

1. Reads PDFs from `rag/documents/`.
2. Extracts text and document metadata.
3. Preserves document ID, title, type, revision, site, unit and asset class.
4. Builds multiple retrieval representations per document/section.
5. Embeds representations with the configured embedding model.
6. Stores vectors in the local Chroma index at `rag/index/`.

## Retrieval

The retriever is configured by:

- `VECTOR_INDEX_PATH`
- `DOCUMENT_PATH`
- `EMBEDDING_MODEL`
- `RETRIEVAL_TOP_K`
- `RETRIEVAL_OVERFETCH`

The current default overfetches vector matches and then deduplicates by document.
This is intentional: multiple representations from the same PDF can match a
query, but the final evidence rail should show unique source documents rather
than repeated copies of the same document.

## Relevance Gate

After vector retrieval, the relevance gate evaluates each unique document result.
It uses lexical overlap, metadata match and retrieval score to decide whether a
document is relevant enough for evidence. Results rejected by the gate are not
used as final citations.

This prevents the system from answering with weakly related manuals when the
corpus does not cover the question.

## Citations

Citations contain:

- document ID,
- document title,
- document kind,
- section/page locator,
- score,
- short snippet,
- longer evidence text for the drawer.

The GUI groups citation snippets by unique document and exposes the relevant
text rather than opening the whole PDF by default.

## Low Confidence Handling

If no document clears the relevance threshold, the unstructured agent returns a
low-confidence result. The final answer states the gap rather than inventing
procedure guidance.

## Prompt-Injection Protection

`KB-3312` contains an embedded hostile instruction fixture. It is deliberately
retrievable and relevant, so the system must treat it as evidence text only, not
as an instruction source. The RAG prompt and final synthesis path instruct the
model to ignore instructions found inside retrieved documents.

## Evaluation

Run retrieval evaluation with:

```bash
.venv/bin/python rag/tests/eval_retrieval.py
```

The expected behavior is high precision for known procedure/manual questions,
correct citation construction, and low-confidence behavior for out-of-corpus
questions.

## Index Refresh

When document content changes:

```bash
.venv/bin/python scripts/generate_corpus.py
.venv/bin/python rag/ingestion/build_index.py --reset
```

The corpus content is maintained in source files and regenerated into PDFs so
document changes remain reviewable.
