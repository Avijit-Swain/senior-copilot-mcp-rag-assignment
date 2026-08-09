# Scripts

Utility scripts for local setup, corpus generation and command-line smoke tests.

| Script | Purpose |
| --- | --- |
| `init_alarm_db.py` | Creates or refreshes the SQLite simulator database |
| `corpus_content.py` | Structured source text for the synthetic PDF corpus |
| `generate_corpus.py` | Regenerates the PDFs under `rag/documents/` |
| `ask.py` | Runs the unstructured RAG agent from the command line |
| `ask_master.py` | Runs the master orchestrator from the command line |

These scripts support development and evaluation; application runtime code
lives under `apps/`, `mcp-servers/` and `rag/`.
