from __future__ import annotations

import json
import operator
import os
from typing import Annotated, Any, Literal, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from openai import OpenAI

from apps.backend.agent.tools.structured_mcp import run_structured_mcp_investigation
from apps.backend.agent.tools.unstructured_rag import run_unstructured_rag

MASTER_MODEL = os.environ.get("MASTER_MODEL", "gpt-5.6-terra")
MAX_MASTER_ROUNDS = int(os.environ.get("MASTER_MAX_ROUNDS", "3"))
MAX_PARALLEL_TASKS = int(os.environ.get("MASTER_MAX_PARALLEL_TASKS", "4"))

MCP_CAPABILITY_CONTEXT = """Structured MCP servers:
- alarm-management: candidate-developed MCP server over the Alarm Management API simulator.
  Tools: search_assets, get_asset_metadata, get_alarms, get_alarm_summary,
  correlate_alarms, score_alarm_priority, get_operator_recommendations.
  Structured data: sites, units, assets, related assets, alarms, occurrences,
  summary KPIs, correlations, priority scores, and operator recommendations.
"""


def _rag_capability_context() -> str:
    try:
        from apps.backend.agent import graph as rag_graph
        return "Unstructured RAG corpus:\n" + rag_graph._catalog_text()
    except Exception as exc:
        return f"Unstructured RAG corpus: catalog unavailable at planning time ({type(exc).__name__})."


def _capability_context() -> str:
    return MCP_CAPABILITY_CONTEXT + "\n" + _rag_capability_context()

ToolName = Literal["structured", "unstructured"]


class MasterTask(TypedDict, total=False):
    index: int
    tool: ToolName
    objective: str
    reason: str
    context: dict[str, Any]


class MasterState(TypedDict, total=False):
    question: str
    action: str
    reason: str
    round: int
    dispatch_rounds: int
    tasks: list[dict[str, Any]]
    observations: Annotated[list[dict[str, Any]], operator.add]
    executed_tasks: Annotated[list[str], operator.add]
    final_answer: str
    citations: list[dict[str, Any]]
    mcp_trace: list[dict[str, Any]]


MASTER_SYSTEM = """You are the master orchestrator for an industrial alarm-investigation copilot.

You use two high-level tools. Each high-level tool may do its own internal reasoning and lower-level calls.

Tool 1: `structured`
- Structured MCP-backed alarm investigation.
- Can search assets, fetch metadata, retrieve alarms, summarize trends, correlate alarms, score priority, and get API operator recommendations.
- Use for asset resolution, active/historical alarm data, priority, correlation, related assets, recommendations, and KPIs.

Tool 2: `unstructured`
- Existing LangGraph ReAct document RAG agent.
- Can retrieve operating procedures, maintenance manuals, troubleshooting guides, safety instructions, alarm philosophy documents, and knowledge articles.
- Use for procedures, manuals, safety guidance, troubleshooting evidence, citations, and checking whether API recommendations agree with documents.

Planning rules:
- Dispatch independent structured/unstructured tasks in the same round when both can run without waiting for the other's output.
- Use sequential rounds when a task needs previous output, for example: first use structured to discover the procedure id or alarm name, then use unstructured to retrieve that specific guidance.
- Do not call a tool just to be thorough. Every task needs a business reason.
- Prefer one structured task that performs the structured MCP chain for a business objective, not one task per low-level endpoint.
- Prefer one unstructured task per distinct document question.
- Stop when observations are sufficient to answer. If data is missing, answer with the gap clearly stated.
- At most {max_parallel_tasks} tasks per dispatch round.

Reply with JSON only:
{{"reason":"one line", "action":"dispatch"|"answer", "tasks":[{{"tool":"structured"|"unstructured", "objective":"...", "reason":"..."}}]}}
Use an empty tasks list when action is answer.
"""


def _observation_text(state: MasterState) -> str:
    obs = state.get("observations", [])
    if not obs:
        return "(no tool observations yet)"
    lines = []
    for item in obs:
        tool = item.get("tool")
        objective = item.get("objective")
        if tool == "structured_mcp_agent":
            data = item.get("data", {})
            lines.append(
                f"- STRUCTURED objective={objective!r}: asset_id={data.get('asset_id')}, "
                f"alarm_id={data.get('alarm_id')}, procedure_ids={data.get('procedure_ids')}, "
                f"alarm_names={data.get('alarm_names')}, calls={len(data.get('mcp_trace', []))}"
            )
        elif tool == "unstructured_rag_agent":
            data = item.get("data", {})
            lines.append(
                f"- UNSTRUCTURED objective={objective!r}: retrieval_rounds={data.get('retrieval_rounds')}, "
                f"citations={len(data.get('citations', []))}, answer={str(data.get('answer', ''))[:220]}"
            )
        else:
            lines.append(f"- {tool} objective={objective!r}: {str(item)[:260]}")
    return "\n".join(lines)


def _structured_context(state: MasterState) -> dict[str, Any]:
    ctx: dict[str, Any] = {}
    for item in state.get("observations", []):
        if item.get("tool") != "structured_mcp_agent":
            continue
        data = item.get("data", {})
        for key in ["asset_id", "alarm_id", "procedure_ids", "alarm_names", "assets"]:
            value = data.get(key)
            if value:
                ctx[key] = value
    return ctx


def call_master_model(state: MasterState) -> dict[str, Any]:
    client = OpenAI()
    resp = client.chat.completions.create(
        model=MASTER_MODEL,
        messages=[
            {"role": "system", "content": MASTER_SYSTEM.format(max_parallel_tasks=MAX_PARALLEL_TASKS)},
            {"role": "user", "content": (
                f"USER QUESTION:\n{state['question']}\n\n"
                f"MASTER ROUND: {state.get('round', 0) + 1} of {MAX_MASTER_ROUNDS}\n\n"
                f"CAPABILITY CONTEXT:\n{_capability_context()}\n\n"
                f"OBSERVATIONS:\n{_observation_text(state)}"
            )},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    return json.loads(resp.choices[0].message.content or "{}")


def fallback_master_decision(state: MasterState) -> dict[str, Any]:
    q = state["question"].lower()
    if state.get("observations"):
        if any(item.get("tool") == "structured_mcp_agent" for item in state.get("observations", [])) and not any(item.get("tool") == "unstructured_rag_agent" for item in state.get("observations", [])) and any(word in q for word in ["procedure", "manual", "safety", "consistent", "guidance"]):
            ctx = _structured_context(state)
            proc = ", ".join(ctx.get("procedure_ids", []))
            return {"reason": "structured context found document identifiers; retrieve document evidence next", "action": "dispatch", "tasks": [{"tool": "unstructured", "objective": f"Find procedure/manual/safety guidance relevant to {proc or state['question']}", "reason": "document evidence depends on structured alarm context"}]}
        return {"reason": "available observations are sufficient for a grounded answer", "action": "answer", "tasks": []}
    needs_structured = any(word in q for word in ["alarm", "asset", "priority", "recommend", "correlat", "recurring", "high-severity", "critical", "motor", "pump", "compressor"])
    needs_unstructured = any(word in q for word in ["procedure", "manual", "safety", "guide", "consistent", "what should", "troubleshoot"])
    tasks = []
    if needs_structured:
        tasks.append({"tool": "structured", "objective": state["question"], "reason": "question asks for structured alarm or asset evidence"})
    if needs_unstructured:
        tasks.append({"tool": "unstructured", "objective": state["question"], "reason": "question asks for document evidence or citations"})
    if not tasks:
        tasks.append({"tool": "unstructured", "objective": state["question"], "reason": "default to document evidence for general guidance"})
    return {"reason": "heuristic fallback planning", "action": "dispatch", "tasks": tasks[:MAX_PARALLEL_TASKS]}


def master_supervisor(state: MasterState) -> dict[str, Any]:
    round_no = state.get("round", 0) + 1
    if round_no > MAX_MASTER_ROUNDS:
        return {"action": "answer", "round": round_no, "reason": "master round budget exhausted", "tasks": []}
    try:
        decision = call_master_model(state)
    except Exception:
        decision = fallback_master_decision(state)
    action = str(decision.get("action", "")).lower()
    tasks = [t for t in decision.get("tasks", []) if isinstance(t, dict) and t.get("tool") in {"structured", "unstructured"} and t.get("objective")]
    already = set(state.get("executed_tasks", []))
    unique = []
    for task in tasks:
        key = f"{task.get('tool')}::{task.get('objective')}"
        if key in already:
            continue
        unique.append(task)
    if action == "dispatch" and not unique:
        action = "answer"
    if action not in {"dispatch", "answer"}:
        action = "dispatch" if unique else "answer"
    return {
        "action": action,
        "round": round_no,
        "dispatch_rounds": state.get("dispatch_rounds", 0) + (1 if action == "dispatch" else 0),
        "reason": str(decision.get("reason", "")),
        "tasks": unique[:MAX_PARALLEL_TASKS] if action == "dispatch" else [],
    }


def route_master(state: MasterState) -> list[Send] | str:
    if state.get("action") != "dispatch" or not state.get("tasks"):
        return "finalize"
    offset = len(state.get("observations", []))
    sends = []
    structured_ctx = _structured_context(state)
    for i, task in enumerate(state["tasks"]):
        payload: MasterTask = {
            "index": offset + i,
            "tool": task["tool"],
            "objective": task["objective"],
            "reason": task.get("reason", ""),
            "context": structured_ctx if task["tool"] == "unstructured" else {},
        }
        sends.append(Send("structured_tool" if task["tool"] == "structured" else "unstructured_tool", payload))
    return sends


def structured_tool(task: MasterTask) -> dict[str, Any]:
    try:
        data = run_structured_mcp_investigation(task["objective"], parent_question=task.get("objective"), context=task.get("context") or {})
    except Exception as exc:
        data = {
            "tool": "structured_mcp_agent",
            "objective": task["objective"],
            "error": {"code": "structured_tool_failed", "message": str(exc)},
            "mcp_trace": [],
        }
    return {
        "executed_tasks": [f"structured::{task['objective']}"],
        "observations": [{"index": task["index"], "tool": "structured_mcp_agent", "objective": task["objective"], "reason": task.get("reason", ""), "data": data}],
    }


def unstructured_tool(task: MasterTask) -> dict[str, Any]:
    try:
        data = run_unstructured_rag(task["objective"], parent_question=task.get("objective"), context=task.get("context") or {})
    except Exception as exc:
        data = {
            "tool": "unstructured_rag_agent",
            "objective": task["objective"],
            "answer": "Document retrieval failed before evidence could be produced.",
            "citations": [],
            "retrieval_rounds": 0,
            "exhausted": True,
            "error": {"code": "unstructured_tool_failed", "message": str(exc)},
        }
    return {
        "executed_tasks": [f"unstructured::{task['objective']}"],
        "observations": [{"index": task["index"], "tool": "unstructured_rag_agent", "objective": task["objective"], "reason": task.get("reason", ""), "data": data}],
    }


SYNTHESIS_SYSTEM = """You write the final response for an alarm-investigation copilot.

Use only the provided structured MCP observations and unstructured RAG observations. Do not invent facts.
Include concise sections when useful: alarm summary, likely causes, recommended actions, document evidence, gaps.
Preserve document citation markers already present in RAG answers. Mention when API recommendations and documents agree or conflict.
Reply in plain text.
"""


def synthesize_answer(state: MasterState) -> str:
    client = OpenAI()
    resp = client.chat.completions.create(
        model=MASTER_MODEL,
        messages=[
            {"role": "system", "content": SYNTHESIS_SYSTEM},
            {"role": "user", "content": f"QUESTION:\n{state['question']}\n\nOBSERVATIONS:\n{json.dumps(state.get('observations', []), default=str)}"},
        ],
        temperature=0,
    )
    return resp.choices[0].message.content or ""


def fallback_synthesis(state: MasterState) -> str:
    lines = ["Investigation summary"]
    for item in sorted(state.get("observations", []), key=lambda x: x.get("index", 0)):
        data = item.get("data", {})
        if item.get("tool") == "structured_mcp_agent":
            lines.append(f"Structured evidence: asset={data.get('asset_id')}, alarm={data.get('alarm_id')}, procedures={', '.join(data.get('procedure_ids', [])) or 'none'}.")
            if data.get("priority") and data["priority"].get("data"):
                p = data["priority"]["data"]
                lines.append(f"Priority: {p.get('priority_band')} ({p.get('score')}).")
            recs = (((data.get("recommendations") or {}).get("data") or {}).get("recommendations") or [])
            for rec in recs[:3]:
                lines.append(f"Recommended action: {rec.get('action_text')}")
        if item.get("tool") == "unstructured_rag_agent":
            answer = data.get("answer")
            if answer:
                lines.append(f"Document evidence: {answer}")
    return "\n".join(lines)


def finalize(state: MasterState) -> dict[str, Any]:
    citations: list[dict[str, Any]] = []
    mcp_trace: list[dict[str, Any]] = []
    seen = set()
    for item in sorted(state.get("observations", []), key=lambda x: x.get("index", 0)):
        data = item.get("data", {})
        if item.get("tool") == "unstructured_rag_agent":
            for c in data.get("citations", []):
                key = (c.get("doc_id"), c.get("section"))
                if key not in seen:
                    seen.add(key)
                    citations.append(c)
        if item.get("tool") == "structured_mcp_agent":
            mcp_trace.extend(data.get("mcp_trace", []))
    try:
        answer = synthesize_answer(state)
    except Exception:
        answer = fallback_synthesis(state)
    return {"final_answer": answer, "citations": citations, "mcp_trace": mcp_trace}


def build_graph():
    g = StateGraph(MasterState)
    g.add_node("master_supervisor", master_supervisor)
    g.add_node("structured_tool", structured_tool)
    g.add_node("unstructured_tool", unstructured_tool)
    g.add_node("finalize", finalize)
    g.add_edge(START, "master_supervisor")
    g.add_conditional_edges("master_supervisor", route_master, ["structured_tool", "unstructured_tool", "finalize"])
    g.add_edge("structured_tool", "master_supervisor")
    g.add_edge("unstructured_tool", "master_supervisor")
    g.add_edge("finalize", END)
    return g.compile()


GRAPH = build_graph()


def ask_master(question: str) -> MasterState:
    return GRAPH.invoke({"question": question})
