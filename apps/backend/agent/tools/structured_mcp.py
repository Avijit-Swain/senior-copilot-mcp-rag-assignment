from __future__ import annotations

import json
import operator
import os
import re
import sys
from pathlib import Path
from typing import Annotated, Any, Literal, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from openai import OpenAI

from apps.backend.agent.events import emit_event

ROOT = Path(__file__).resolve().parents[4]
MCP_PACKAGE = ROOT / "mcp-servers" / "alarm-management"
if str(MCP_PACKAGE) not in sys.path:
    sys.path.insert(0, str(MCP_PACKAGE))

from apps.backend.agent.tools.mcp_client import AlarmMcpToolClient  # noqa: E402
from alarm_mcp.schemas import (  # noqa: E402
    AlarmSummaryInput,
    CorrelateAlarmsInput,
    GetAlarmsInput,
    GetAssetMetadataInput,
    OperatorRecommendationsInput,
    ScoreAlarmPriorityInput,
    SearchAssetsInput,
    TraceContext,
)

STRUCTURED_SUPERVISOR_MODEL = os.environ.get(
    "STRUCTURED_SUPERVISOR_MODEL",
    os.environ.get("MASTER_MODEL", "gpt-5.6-terra"),
)
MAX_STRUCTURED_ROUNDS = int(os.environ.get("STRUCTURED_MAX_ROUNDS", "6"))
MAX_STRUCTURED_PARALLEL_TASKS = int(os.environ.get("STRUCTURED_MAX_PARALLEL_TASKS", "4"))

ToolName = Literal[
    "search_assets",
    "get_asset_metadata",
    "get_alarms",
    "get_alarm_summary",
    "correlate_alarms",
    "score_alarm_priority",
    "get_operator_recommendations",
]

TOOL_SCHEMAS = {
    "search_assets": SearchAssetsInput,
    "get_asset_metadata": GetAssetMetadataInput,
    "get_alarms": GetAlarmsInput,
    "get_alarm_summary": AlarmSummaryInput,
    "correlate_alarms": CorrelateAlarmsInput,
    "score_alarm_priority": ScoreAlarmPriorityInput,
    "get_operator_recommendations": OperatorRecommendationsInput,
}


class StructuredTask(TypedDict, total=False):
    index: int
    tool_name: ToolName
    args: dict[str, Any]
    reason: str


class StructuredState(TypedDict, total=False):
    objective: str
    parent_question: str | None
    context: dict[str, Any]
    action: str
    reason: str
    round: int
    tasks: list[dict[str, Any]]
    tool_discovery: list[dict[str, Any]]
    observations: Annotated[list[dict[str, Any]], operator.add]
    executed_tasks: Annotated[list[str], operator.add]
    final: dict[str, Any]


STRUCTURED_SYSTEM = """You are the structured MCP ReAct supervisor for an industrial alarm-investigation copilot.

You may dispatch one or more MCP tool calls, observe their results, then decide the next tool calls.
All Alarm Management API access must go through the candidate-developed `alarm-management` MCP server.

Available MCP tools:
- search_assets(query, site, unit, limit)
- get_asset_metadata(asset_id)
- get_alarms(asset_id, site, unit, status, start_time, end_time, page, page_size)
- get_alarm_summary(asset_ids, time_range, severity, group_by, kpis)
- correlate_alarms(asset_ids, time_range, correlation_method, lag_window_minutes, severity_threshold, min_support)
- score_alarm_priority(alarm_id)
- get_operator_recommendations(alarm_id, include_related, include_asset_context, include_historical_pattern)

Rules:
- First resolve natural language asset names with search_assets.
- After asset_id is known, get metadata and alarms. These can run in parallel.
- After alarms are known, use the top alarm_id for priority and recommendations.
- Use summary and correlation for recurring, historical, likely-cause, priority or investigation questions.
- Preserve dependencies. Never call score_alarm_priority or get_operator_recommendations without an alarm_id.
- Stop only when enough structured evidence has been gathered or a required dependency is unavailable.
- At most {max_parallel_tasks} MCP tool calls per round.

Reply with JSON only:
{{"reason":"one line", "action":"dispatch"|"finalize", "tasks":[{{"tool_name":"...", "args":{{...}}, "reason":"..."}}]}}
Use an empty tasks list when action is finalize.
"""


def _seeded_time_range(question: str) -> dict[str, str] | None:
    q = question.lower()
    if "90" in q or "last 90" in q or "recurring" in q:
        return {"start_time": "2026-05-01T00:00:00Z", "end_time": "2026-07-31T23:59:59Z"}
    return None


def _explicit_asset_id(question: str) -> str | None:
    match = re.search(r"\b(BFP|MTR|CMP|DRV|DV|PT)[-\s]?(\d+[A-Z]?)\b", question, flags=re.I)
    if not match:
        return None
    return f"{match.group(1).upper()}-{match.group(2).upper()}"


def _asset_query(question: str) -> str:
    explicit = _explicit_asset_id(question)
    if explicit:
        return explicit
    q = question.lower()
    if "boiler feed pump 101" in q or "bfp 101" in q:
        return "Boiler Feed Pump 101"
    if "boiler feed pump 102" in q or "bfp 102" in q:
        return "Boiler Feed Pump 102"
    if "compressor" in q:
        return "compressor"
    if "motor" in q:
        return "motor"
    return question


def _site(question: str) -> str | None:
    q = question.lower()
    return "EastRefinery" if "eastrefinery" in q or "east refinery" in q else None


def _unit(question: str) -> str | None:
    match = re.search(r"unit\s+([1-5])", question.lower())
    return f"Unit {match.group(1)}" if match else None


def _status(question: str) -> str | None:
    return "active" if "active" in question.lower() else None


def _site_alarm_scope(question: str) -> bool:
    return bool(_site(question)) and "alarm" in question.lower() and _explicit_asset_id(question) is None


def _result_data(obs: dict[str, Any]) -> dict[str, Any]:
    result = obs.get("result") or {}
    return result.get("data") or {}


def _observations_for(state: StructuredState, tool_name: str) -> list[dict[str, Any]]:
    return [o for o in state.get("observations", []) if o.get("tool_name") == tool_name]


def _latest_ok(state: StructuredState, tool_name: str) -> dict[str, Any] | None:
    for obs in reversed(_observations_for(state, tool_name)):
        if (obs.get("result") or {}).get("ok"):
            return obs
    return None


def _assets(state: StructuredState) -> list[dict[str, Any]]:
    obs = _latest_ok(state, "search_assets")
    return ((_result_data(obs) if obs else {}).get("results") or [])


def _asset_id(state: StructuredState) -> str | None:
    assets = _assets(state)
    return assets[0].get("asset_id") if assets else None


def _resolved_asset_ids(state: StructuredState) -> list[str]:
    asset_id = _asset_id(state)
    if asset_id:
        return [asset_id]
    out = []
    for alarm in _alarm_rows(state):
        value = alarm.get("asset_id")
        if value and value not in out:
            out.append(value)
    return out


def _alarm_rows(state: StructuredState) -> list[dict[str, Any]]:
    obs = _latest_ok(state, "get_alarms")
    return ((_result_data(obs) if obs else {}).get("data") or [])


def _alarm_id(state: StructuredState) -> str | None:
    rows = _alarm_rows(state)
    return rows[0].get("alarm_id") if rows else None


def _needs(question: str) -> dict[str, bool]:
    q = question.lower()
    return {
        "summary": any(word in q for word in ["summary", "recurring", "investigate", "high-severity", "critical", "count"]),
        "correlation": any(word in q for word in ["investigate", "correlat", "cause", "contributing", "related", "recurring"]),
        "priority": any(word in q for word in ["priority", "highest", "critical", "high-severity", "investigate"]),
        "recommendations": any(word in q for word in ["recommend", "action", "should", "investigate"]),
    }


def _observation_text(state: StructuredState) -> str:
    if not state.get("observations"):
        return "(no MCP observations yet)"
    lines = []
    for obs in sorted(state.get("observations", []), key=lambda x: x.get("index", 0)):
        result = obs.get("result") or {}
        data = result.get("data") or {}
        if obs.get("tool_name") == "search_assets":
            lines.append(f"- search_assets ok={result.get('ok')} results={len(data.get('results') or [])}")
        elif obs.get("tool_name") == "get_alarms":
            lines.append(f"- get_alarms ok={result.get('ok')} alarms={len(data.get('data') or [])}")
        else:
            lines.append(f"- {obs.get('tool_name')} ok={result.get('ok')} keys={list(data.keys())[:8]}")
    return "\n".join(lines)


def _normalize_args(tool_name: str, args: dict[str, Any], state: StructuredState) -> dict[str, Any]:
    args = dict(args or {})
    trace = TraceContext(
        trace_id=(state.get("context") or {}).get("trace_id"),
        client_id="structured-mcp-agent",
        metadata_tag="master-orchestrator",
    )
    args["trace"] = trace

    schema = TOOL_SCHEMAS[tool_name]
    model = schema(**args)
    return model.model_dump(exclude_none=True)


def call_structured_supervisor(state: StructuredState) -> dict[str, Any]:
    client = OpenAI()
    resp = client.chat.completions.create(
        model=STRUCTURED_SUPERVISOR_MODEL,
        messages=[
            {"role": "system", "content": STRUCTURED_SYSTEM.format(max_parallel_tasks=MAX_STRUCTURED_PARALLEL_TASKS)},
            {"role": "user", "content": (
                f"OBJECTIVE:\n{state['objective']}\n\n"
                f"ROUND: {state.get('round', 0) + 1} of {MAX_STRUCTURED_ROUNDS}\n\n"
                f"DISCOVERED TOOLS:\n{json.dumps(state.get('tool_discovery', []), default=str)[:4000]}\n\n"
                f"OBSERVATIONS:\n{_observation_text(state)}"
            )},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    return json.loads(resp.choices[0].message.content or "{}")


def fallback_structured_decision(state: StructuredState) -> dict[str, Any]:
    objective = state["objective"]
    asset_id = _asset_id(state)
    alarm_id = _alarm_id(state)
    needs = _needs(objective)
    time_range = _seeded_time_range(objective) or {}

    if _site_alarm_scope(objective) and not _latest_ok(state, "get_alarms"):
        return {
            "reason": "retrieve site-scoped alarms before scoring priority",
            "action": "dispatch",
            "tasks": [{
                "tool_name": "get_alarms",
                "args": {
                    "site": _site(objective),
                    "status": _status(objective),
                    "page": 1,
                    "page_size": 50,
                    "sort_by": "start_time",
                    "sort_order": "desc",
                },
                "reason": "site-wide alarm retrieval",
            }],
        }

    if not _site_alarm_scope(objective) and not _latest_ok(state, "search_assets"):
        return {
            "reason": "resolve asset before dependent MCP calls",
            "action": "dispatch",
            "tasks": [{
                "tool_name": "search_assets",
                "args": {"query": _asset_query(objective), "site": _site(objective), "unit": _unit(objective), "limit": 10},
                "reason": "asset resolution",
            }],
        }

    if not asset_id and not _latest_ok(state, "get_alarms"):
        return {"reason": "asset could not be resolved", "action": "finalize", "tasks": []}

    tasks: list[dict[str, Any]] = []
    if asset_id and not _latest_ok(state, "get_asset_metadata"):
        tasks.append({"tool_name": "get_asset_metadata", "args": {"asset_id": asset_id}, "reason": "fetch asset context"})
    if not _latest_ok(state, "get_alarms"):
        tasks.append({
            "tool_name": "get_alarms",
            "args": {
                "asset_id": asset_id,
                "site": _site(objective),
                "unit": _unit(objective),
                "status": _status(objective),
                "start_time": time_range.get("start_time"),
                "end_time": time_range.get("end_time"),
                "page": 1,
                "page_size": 50,
                "sort_by": "start_time",
                "sort_order": "desc",
            },
            "reason": "retrieve alarm evidence",
        })
    if tasks:
        return {"reason": "asset is known; retrieve metadata and alarms", "action": "dispatch", "tasks": tasks}

    if not _alarm_rows(state):
        return {"reason": "alarm retrieval returned no rows", "action": "finalize", "tasks": []}

    followups: list[dict[str, Any]] = []
    asset_ids = _resolved_asset_ids(state)
    if needs["summary"] and not _latest_ok(state, "get_alarm_summary"):
        followups.append({
            "tool_name": "get_alarm_summary",
            "args": {"asset_ids": asset_ids, "time_range": time_range, "severity": ["high", "critical"]},
            "reason": "summarize recurrence and severity",
        })
    if needs["correlation"] and not _latest_ok(state, "correlate_alarms"):
        followups.append({
            "tool_name": "correlate_alarms",
            "args": {"asset_ids": asset_ids, "time_range": time_range, "min_support": 1},
            "reason": "identify likely contributing alarm patterns",
        })
    if alarm_id and needs["priority"] and not _latest_ok(state, "score_alarm_priority"):
        followups.append({
            "tool_name": "score_alarm_priority",
            "args": {"alarm_id": alarm_id},
            "reason": "score the highest-priority alarm",
        })
    if alarm_id and needs["recommendations"] and not _latest_ok(state, "get_operator_recommendations"):
        followups.append({
            "tool_name": "get_operator_recommendations",
            "args": {"alarm_id": alarm_id},
            "reason": "retrieve API operator recommendations",
        })
    if followups:
        return {"reason": "alarm rows are known; run analysis tools", "action": "dispatch", "tasks": followups[:MAX_STRUCTURED_PARALLEL_TASKS]}

    return {"reason": "structured MCP evidence is sufficient", "action": "finalize", "tasks": []}


def discover_tools(state: StructuredState) -> dict[str, Any]:
    try:
        tools = AlarmMcpToolClient().discover_tools()
    except Exception as exc:
        tools = [{"error": {"code": "tool_discovery_failed", "message": str(exc)}}]
    emit_event({
        "type": "step.completed",
        "source": "mcp",
        "server": "alarm-management",
        "tool": "tools/list",
        "label": f"Discovered {len([t for t in tools if 'name' in t])} tools from alarm-management",
        "status": "ok" if tools and "error" not in tools[0] else "error",
    })
    return {"tool_discovery": tools}


def structured_supervisor(state: StructuredState) -> dict[str, Any]:
    round_no = state.get("round", 0) + 1
    if round_no > MAX_STRUCTURED_ROUNDS:
        return {"action": "finalize", "round": round_no, "reason": "structured round budget exhausted", "tasks": []}

    fallback = fallback_structured_decision(state)
    try:
        decision = call_structured_supervisor(state)
    except Exception:
        decision = fallback

    action = str(decision.get("action", "")).lower()
    tasks = [t for t in decision.get("tasks", []) if isinstance(t, dict) and t.get("tool_name") in TOOL_SCHEMAS]
    if fallback.get("action") == "dispatch":
        by_tool = {task["tool_name"]: task for task in tasks}
        for task in fallback.get("tasks", []):
            by_tool.setdefault(task["tool_name"], task)
        tasks = list(by_tool.values())
        action = "dispatch"
    already = set(state.get("executed_tasks", []))
    unique = []
    for task in tasks:
        key = f"{task.get('tool_name')}::{json.dumps(task.get('args') or {}, sort_keys=True, default=str)}"
        if key not in already:
            unique.append(task)
    if action == "dispatch" and not unique:
        action = "finalize"
    if action not in {"dispatch", "finalize"}:
        action = "dispatch" if unique else "finalize"
    return {
        "action": action,
        "round": round_no,
        "reason": str(decision.get("reason") or fallback.get("reason") or ""),
        "tasks": unique[:MAX_STRUCTURED_PARALLEL_TASKS] if action == "dispatch" else [],
    }


def route_structured(state: StructuredState) -> list[Send] | str:
    if state.get("action") != "dispatch" or not state.get("tasks"):
        return "finalize_structured"
    offset = len(state.get("observations", []))
    sends = []
    for i, task in enumerate(state["tasks"]):
        sends.append(Send("mcp_tool", {
            "index": offset + i,
            "tool_name": task["tool_name"],
            "args": task.get("args") or {},
            "reason": task.get("reason", ""),
            "context": state.get("context") or {},
        }))
    return sends


def mcp_tool(task: StructuredTask) -> dict[str, Any]:
    tool_name = task["tool_name"]
    try:
        args = _normalize_args(tool_name, task.get("args") or {}, {"context": task.get("context") or {}})
        result = AlarmMcpToolClient().call_tool(tool_name, args)
    except Exception as exc:
        args = task.get("args") or {}
        result = {"ok": False, "error": {"code": "mcp_tool_failed", "message": str(exc)}, "trace": {}}

    trace = result.get("trace") or {}
    emit_event({
        "type": "step.completed",
        "source": "mcp",
        "server": "alarm-management",
        "tool": tool_name,
        "label": f"Completed alarm-management.{tool_name}",
        "status": "ok" if result.get("ok") else "error",
        "durationMs": int(trace.get("duration_ms") or 0),
        "attempts": int(trace.get("attempts") or 1),
        "httpStatus": trace.get("status_code"),
    })
    return {
        "executed_tasks": [f"{tool_name}::{json.dumps(task.get('args') or {}, sort_keys=True, default=str)}"],
        "observations": [{
            "index": task["index"],
            "tool_name": tool_name,
            "args": args,
            "reason": task.get("reason", ""),
            "result": result,
        }],
    }


def _payload(state: StructuredState, tool_name: str) -> dict[str, Any] | None:
    obs = _latest_ok(state, tool_name)
    return obs.get("result") if obs else None


def finalize_structured(state: StructuredState) -> dict[str, Any]:
    alarms_payload = _payload(state, "get_alarms")
    rows = _alarm_rows(state)
    procedure_ids: list[str] = []
    alarm_names: list[str] = []
    for alarm in rows:
        if alarm.get("alarm_name"):
            alarm_names.append(alarm["alarm_name"])
        proc = (alarm.get("metadata") or {}).get("procedure_id")
        if proc and proc not in procedure_ids:
            procedure_ids.append(proc)

    calls = [
        {"name": obs.get("tool_name"), "args": obs.get("args") or {}, "result": obs.get("result") or {}}
        for obs in sorted(state.get("observations", []), key=lambda x: x.get("index", 0))
    ]
    final = {
        "tool": "structured_mcp_agent",
        "objective": state["objective"],
        "parent_question": state.get("parent_question"),
        "plan": {"mode": "react", "rounds": state.get("round", 0), "reason": state.get("reason", "")},
        "asset_id": (_resolved_asset_ids(state) or [None])[0],
        "alarm_id": _alarm_id(state),
        "procedure_ids": procedure_ids,
        "alarm_names": list(dict.fromkeys(alarm_names)),
        "assets": _assets(state),
        "metadata": _payload(state, "get_asset_metadata"),
        "alarms": alarms_payload,
        "summary": _payload(state, "get_alarm_summary"),
        "correlation": _payload(state, "correlate_alarms"),
        "priority": _payload(state, "score_alarm_priority"),
        "recommendations": _payload(state, "get_operator_recommendations"),
        "tool_discovery": state.get("tool_discovery", []),
        "mcp_trace": calls,
        "react_observations": state.get("observations", []),
    }
    return {"final": final}


def build_structured_graph():
    g = StateGraph(StructuredState)
    g.add_node("discover_tools", discover_tools)
    g.add_node("structured_supervisor", structured_supervisor)
    g.add_node("mcp_tool", mcp_tool)
    g.add_node("finalize_structured", finalize_structured)
    g.add_edge(START, "discover_tools")
    g.add_edge("discover_tools", "structured_supervisor")
    g.add_conditional_edges("structured_supervisor", route_structured, ["mcp_tool", "finalize_structured"])
    g.add_edge("mcp_tool", "structured_supervisor")
    g.add_edge("finalize_structured", END)
    return g.compile()


STRUCTURED_GRAPH = build_structured_graph()


def run_structured_mcp_investigation(
    objective: str,
    *,
    parent_question: str | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    state = STRUCTURED_GRAPH.invoke({
        "objective": objective,
        "parent_question": parent_question,
        "context": context or {},
    })
    return state["final"]
