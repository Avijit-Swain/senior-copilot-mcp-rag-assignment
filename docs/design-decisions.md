# Design Decisions

## One Business Workflow, Two Evidence Paths

The assignment requires MCP and RAG to participate in the same workflow. The
architecture therefore uses one master orchestrator that can call both the
structured MCP agent and the unstructured RAG agent for the same user question.
This avoids a disconnected "MCP demo" and "RAG demo".

## Master Orchestrator Above Specialist Agents

The master orchestrator owns decomposition, sequencing and final synthesis.
Specialist agents own source-specific work:

- structured agent: asset/alarm/API/MCP reasoning,
- unstructured agent: document retrieval and citation reasoning.

This keeps the master prompt aware of capabilities without making it manage
every low-level MCP call.

## Parallel and Sequential Dispatch

The master can dispatch independent structured and unstructured tasks in the
same round. It can also sequence tasks when dependencies exist. For example, it
can call structured first to discover an alarm or procedure reference, then call
unstructured RAG to retrieve the specific procedure.

## Structured Agent as ReAct Supervisor

The structured path is not a single hard-coded endpoint chain. It is a
ReAct-style LangGraph supervisor over the available MCP tools. It observes tool
results and decides the next MCP call set, while still having deterministic
fallback planning for reliability during tests.

## MCP Boundary Is Preserved

The copilot orchestration layer accesses Alarm Management data through the MCP
client path. The MCP server owns direct Alarm API calls, authentication, retries,
timeout configuration, error mapping and trace propagation.

## Synthetic but Purposeful Data

The API data and documents are synthetic to keep the repository shareable. They
are still designed around realistic alarm-investigation workflows:

- BFP-101 recurring high-severity alarms,
- BFP-102 active critical alarms,
- EastRefinery priority questions,
- motor-trip safety checks,
- API/manual consistency checks.

## Document-Level Deduplication

The RAG index can retrieve several vector representations from the same
document. The retriever overfetches vectors, deduplicates to unique documents,
and then applies a relevance gate. This reduces repeated citations and makes the
evidence rail easier to inspect.

## Relevance Gate Before Final Evidence

Unique documents are still evaluated for relevance. This prevents weak matches
from appearing simply because they were among the top vector results.

## UI Traceability

The GUI keeps the main chat readable and moves source details to the right rail:

- current evidence and trace are expanded in the rail,
- previous turns appear as collapsed sections in the rail,
- citations open relevant evidence text instead of forcing full PDF browsing.

## Follow-Up Context

The frontend sends the previous user/assistant pair as compact context. The
master uses it to resolve follow-up references such as "that alarm" or "the same
asset", but tools are still called again when current evidence is needed.

## Configurable Models

Model names are environment-driven. The master and structured supervisor can use
more capable models, while the document/tool path can use smaller models where
appropriate.
