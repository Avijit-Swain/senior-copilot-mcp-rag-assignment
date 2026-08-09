# Known Limitations

This repository implements the core MCP-plus-RAG copilot workflow. The remaining
items are submission polish and environment-dependent hardening rather than
missing core architecture.

## Packaging

- `Dockerfile`, `docker-compose.yml` and `Makefile` are included.
- `docker compose config` validates the compose configuration.
- Full image build/runtime verification requires a running local Docker daemon.
- If `rag/index/` is not present, compose startup requires `OPENAI_API_KEY` so
  the backend can build the vector index.

## Continuous Integration

- GitHub Actions workflow is included in `.github/workflows/ci.yml`.
- CI runs backend/MCP/orchestration tests, frontend typecheck/build and compose
  config validation.
- RAG retrieval evaluation is optional because it needs an API key for embedding
  calls.

## Demo Artifacts

- No demo video is included in the repository.
- Screenshots/recording should be captured before final submission.

## Coverage Report

- Coverage is configured through `.coveragerc`.
- `make coverage` runs the Python test suite with terminal and XML coverage
  output.
- CI uploads `coverage.xml` as an artifact for review.
- The generated report is intentionally ignored by Git so local runs do not add
  report churn to commits.

## Deployment

- The app is designed for local evaluation.
- It does not yet include production deployment manifests, managed secret
  storage, TLS termination or container health checks.

## Data Scope

- The Alarm Management API data is synthetic and intentionally small.
- The document corpus is synthetic and limited to the assignment's alarm
  investigation scenarios.
- Out-of-domain questions should return low-confidence responses rather than
  broad plant guidance.

## Model Availability

- Model names are configurable. The default values assume the evaluator has
  compatible model access or will update `.env`.
- If a configured model is unavailable, the system must be pointed at an
  available equivalent model.

## Browser Support

- Voice input uses the browser speech-recognition API where available.
- Browsers without that API will still support typed chat.

## UI Scope

- The GUI is a local operator-facing investigation workspace, not a full
  enterprise admin portal.
- Structured/unstructured data pages are previews of available sources, not full
  database or document-management tools.
