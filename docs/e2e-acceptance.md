# E2E Acceptance Evidence

This document records the mandatory assignment acceptance scenario and the
automated proof included in the repository.

## Scenario

```text
Investigate recurring high-severity alarms for Boiler Feed Pump 101 over the last 90 days,
identify likely contributing factors, retrieve the relevant operating procedure, and provide
recommended actions with source evidence.
```

## Automated Test

Test file:

```text
tests/e2e/test_acceptance_bfp101.py
```

Run:

```bash
PYTHONPATH="$PWD/mcp-servers/alarm-management:$PWD" \
.venv/bin/python -m pytest tests/e2e/test_acceptance_bfp101.py -q
```

The full suite also includes the E2E test:

```bash
PYTHONPATH="$PWD/mcp-servers/alarm-management:$PWD" \
.venv/bin/python -m pytest tests -q
```

## What the Test Proves

The test validates the complete copilot contract for the mandatory BFP-101
scenario:

| Requirement | Assertion |
| --- | --- |
| Natural-language request | Uses the exact BFP-101 recurring high-severity investigation prompt |
| Structured MCP path | Asserts `structured_mcp_agent` is invoked |
| Alarm API data used | Asserts asset `BFP-101`, alarm `ALM-BFP101-DP-HH`, priority and recommendations are present |
| MCP traceability | Asserts trace contains asset search, alarm retrieval, summary, correlation, priority and recommendation calls |
| RAG path | Asserts `unstructured_rag_agent` is invoked |
| Source citations | Asserts final citations include `SOP-114` |
| Combined reasoning | Asserts final answer includes the top alarm, recommended action and document reference |
| Parallel orchestration | Asserts the master dispatches both evidence paths in one round |

## Why the Test Uses Deterministic Stubs

The specialist structured and unstructured agents are stubbed at the master
orchestrator boundary. This keeps CI deterministic and avoids requiring live LLM
or embedding calls for every pull request.

The test still proves the end-to-end acceptance contract at the copilot layer:

1. The master receives the real scenario prompt.
2. The master dispatches both structured MCP and unstructured RAG paths.
3. Structured evidence includes realistic MCP trace records and alarm data.
4. RAG evidence includes document citations.
5. The final state exposes combined answer, citations and MCP trace.

Lower-level tests separately cover the Alarm API simulator, MCP client behavior,
tool routing and backend response normalization.

## Expected Result

```text
1 passed
```

When run with the complete test suite:

```text
24 tests passed
```
