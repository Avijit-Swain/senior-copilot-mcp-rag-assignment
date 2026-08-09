# Known Limitations

This repository implements the core MCP-plus-RAG copilot workflow, but several
submission hardening items remain.

## Packaging

- No `Dockerfile` is included yet.
- No `docker-compose.yml` is included yet.
- There is no single `make up` or equivalent command.

The current startup path is local Python plus Vite, documented in `README.md`.

## Continuous Integration

- No GitHub Actions workflow is included yet.
- Validation has been run locally through pytest, TypeScript typecheck and Vite
  build.

## Demo Artifacts

- No demo video is included in the repository.
- Screenshots/recording should be captured before final submission.

## Coverage Report

- There is no committed coverage report.
- Tests exist for API simulator behavior, MCP client behavior, orchestration
  routing, context routing and backend integration, but coverage has not been
  packaged as an artifact.

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
