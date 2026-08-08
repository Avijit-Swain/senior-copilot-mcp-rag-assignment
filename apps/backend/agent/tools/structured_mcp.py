from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from openai import OpenAI

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
    TimeRange,
    TraceContext,
)

STRUCTURED_MODEL = os.environ.get("STRUCTURED_AGENT_MODEL", "gpt-4.1")

STRUCTURED_SYSTEM = """You are the structured-data agent for an alarm-investigation copilot.

You decide how to query MCP-backed Alarm Management tools. Return JSON only.
Focus on extracting the asset/site/unit, time range, and which structured operations are needed.

Available MCP tools:
- search_assets(query, site, unit, limit)
- get_asset_metadata(asset_id)
- get_alarms(asset_id, site, unit, status, start_time, end_time, page, page_size)
- get_alarm_summary(asset_ids, time_range, severity, group_by, kpis)
- correlate_alarms(asset_ids, time_range, correlation_method, lag_window_minutes, severity_threshold, min_support)
- score_alarm_priority(alarm_id)
- get_operator_recommendations(alarm_id, include_related, include_asset_context, include_historical_pattern)

Reply shape:
{"asset_query":"...", "site": null|string, "unit": null|string,
 "time_range":{"start_time": null|string, "end_time": null|string},
 "needs":{"metadata": true|false, "alarms": true|false, "summary": true|false,
          "correlation": true|false, "priority": true|false, "recommendations": true|false},
 "reason":"..."}
"""


def _fallback_plan(question: str) -> dict[str, Any]:
    q = question.lower()
    asset_query = "Boiler Feed Pump 101" if "boiler feed pump 101" in q or "bfp 101" in q else question
    if "boiler feed pump 102" in q or "bfp 102" in q:
        asset_query = "Boiler Feed Pump 102"
    if "compressor" in q:
        asset_query = "compressor"
    if "motor" in q:
        asset_query = "motor"
    site = "EastRefinery" if "eastrefinery" in q or "east refinery" in q else None
    unit_match = re.search(r"unit\s+([1-5])", q)
    unit = f"Unit {unit_match.group(1)}" if unit_match else None
    return {
        "asset_query": asset_query,
        "site": site,
        "unit": unit,
        "time_range": {"start_time": "2026-05-01T00:00:00Z" if "90" in q or "recurring" in q else None,
                        "end_time": "2026-07-31T23:59:59Z" if "90" in q or "recurring" in q else None},
        "needs": {
            "metadata": True,
            "alarms": True,
            "summary": "summary" in q or "recurring" in q or "count" in q,
            "correlation": "investigate" in q or "why" in q or "correlat" in q or "cause" in q or "contributing" in q or "related" in q,
            "priority": "priority" in q or "highest" in q or "critical" in q or "high-severity" in q,
            "recommendations": "recommend" in q or "action" in q or "should" in q,
        },
        "reason": "heuristic fallback plan",
    }


def plan_structured_investigation(question: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    if os.environ.get("DISABLE_STRUCTURED_LLM_PLANNER") == "1":
        return _fallback_plan(question)
    try:
        client = OpenAI()
        resp = client.chat.completions.create(
            model=STRUCTURED_MODEL,
            messages=[
                {"role": "system", "content": STRUCTURED_SYSTEM},
                {"role": "user", "content": f"QUESTION:\n{question}\n\nCONTEXT:\n{json.dumps(context or {}, default=str)}"},
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        fallback = _fallback_plan(question)
        fallback.update({k: v for k, v in data.items() if v is not None})
        fallback["needs"] = {**_fallback_plan(question)["needs"], **data.get("needs", {})}
        return fallback
    except Exception:
        return _fallback_plan(question)


def _result(result) -> dict[str, Any]:
    return result.model_dump(exclude_none=True)


def _first_alarm_id(alarms_payload: dict[str, Any]) -> str | None:
    rows = (((alarms_payload or {}).get("data") or {}).get("data") if isinstance((alarms_payload or {}).get("data"), dict) else None)
    if rows is None:
        rows = (alarms_payload or {}).get("data") or []
    if rows:
        return rows[0].get("alarm_id")
    return None


def run_structured_mcp_investigation(objective: str, *, parent_question: str | None = None, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run a sequential MCP-backed structured investigation chain.

    This is the high-level structured tool used by the master orchestrator. It
    keeps low-level Alarm MCP calls traceable while letting the master reason in
    terms of business objectives.
    """
    plan = plan_structured_investigation(objective, context)
    trace = TraceContext(trace_id=(context or {}).get("trace_id"), client_id="structured-mcp-agent", metadata_tag="master-orchestrator")
    client = AlarmMcpToolClient()
    discovered_tools = client.discover_tools()
    calls: list[dict[str, Any]] = []

    def record(name: str, args: dict[str, Any]) -> dict[str, Any]:
        result = client.call_tool(name, args)
        item = {"name": name, "args": args, "result": result}
        calls.append(item)
        return result

    search_args = SearchAssetsInput(query=plan.get("asset_query") or objective, site=plan.get("site"), unit=plan.get("unit"), limit=10, trace=trace)
    search_payload = record("search_assets", search_args.model_dump(exclude_none=True))
    assets = ((search_payload.get("data") or {}).get("results") or []) if search_payload.get("ok") else []
    asset_id = assets[0]["asset_id"] if assets else None

    metadata_payload = None
    alarms_payload = None
    summary_payload = None
    correlation_payload = None
    priority_payload = None
    recommendations_payload = None
    alarm_id = None

    needs = plan.get("needs") or {}
    time_range = TimeRange(**(plan.get("time_range") or {}))

    if asset_id and needs.get("metadata", True):
        args = GetAssetMetadataInput(asset_id=asset_id, trace=trace)
        metadata_payload = record("get_asset_metadata", args.model_dump(exclude_none=True))

    if needs.get("alarms", True):
        args = GetAlarmsInput(asset_id=asset_id, site=plan.get("site"), unit=plan.get("unit"), start_time=time_range.start_time, end_time=time_range.end_time, page=1, page_size=50, sort_by="start_time", sort_order="desc", trace=trace)
        alarms_payload = record("get_alarms", args.model_dump(exclude_none=True))
        alarm_id = _first_alarm_id(alarms_payload)

    asset_ids = [asset_id] if asset_id else []
    if asset_ids and needs.get("summary"):
        args = AlarmSummaryInput(asset_ids=asset_ids, time_range=time_range, trace=trace)
        summary_payload = record("get_alarm_summary", args.model_dump(exclude_none=True))

    if asset_ids and needs.get("correlation"):
        args = CorrelateAlarmsInput(asset_ids=asset_ids, time_range=time_range, trace=trace)
        correlation_payload = record("correlate_alarms", args.model_dump(exclude_none=True))

    if alarm_id and needs.get("priority"):
        args = ScoreAlarmPriorityInput(alarm_id=alarm_id, trace=trace)
        priority_payload = record("score_alarm_priority", args.model_dump(exclude_none=True))

    if alarm_id and needs.get("recommendations"):
        args = OperatorRecommendationsInput(alarm_id=alarm_id, trace=trace)
        recommendations_payload = record("get_operator_recommendations", args.model_dump(exclude_none=True))

    procedure_ids = []
    alarm_names = []
    if alarms_payload and alarms_payload.get("ok"):
        for alarm in (alarms_payload.get("data") or {}).get("data", []):
            alarm_names.append(alarm.get("alarm_name"))
            proc = (alarm.get("metadata") or {}).get("procedure_id")
            if proc and proc not in procedure_ids:
                procedure_ids.append(proc)

    return {
        "tool": "structured_mcp_agent",
        "objective": objective,
        "parent_question": parent_question,
        "plan": plan,
        "asset_id": asset_id,
        "alarm_id": alarm_id,
        "procedure_ids": procedure_ids,
        "alarm_names": [x for x in alarm_names if x],
        "assets": assets,
        "metadata": metadata_payload,
        "alarms": alarms_payload,
        "summary": summary_payload,
        "correlation": correlation_payload,
        "priority": priority_payload,
        "recommendations": recommendations_payload,
        "tool_discovery": discovered_tools,
        "mcp_trace": calls,
    }
