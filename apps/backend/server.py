from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from aiohttp import web

ROOT = Path(__file__).resolve().parents[2]
MCP_PACKAGE = ROOT / "mcp-servers" / "alarm-management"
for path in [ROOT, MCP_PACKAGE]:
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from apps.backend.agent.master_graph import ask_master  # noqa: E402

SEVERITIES = ["critical", "high", "medium", "low"]
DOC_KIND_MAP = {
    "operating-procedure": "operating-procedure",
    "maintenance-manual": "maintenance-manual",
    "troubleshooting-guide": "troubleshooting-guide",
    "safety-instruction": "safety-instruction",
    "alarm-philosophy": "alarm-philosophy",
    "knowledge-article": "troubleshooting-guide",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def split_paragraphs(text: str) -> tuple[str, list[str]]:
    parts = [p.strip() for p in (text or "").split("\n") if p.strip()]
    if not parts:
        return "Investigation complete", []
    return parts[0], parts[1:] or parts[:1]


def normalize_citations(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    citations = []
    for i, c in enumerate(raw, 1):
        kind = DOC_KIND_MAP.get(str(c.get("kind") or "").lower(), "operating-procedure")
        doc_id = c.get("doc_id") or c.get("documentId") or "DOC"
        section = c.get("section") or ""
        citations.append({
            "ref": i,
            "documentId": doc_id,
            "title": c.get("document_title") or c.get("title") or doc_id,
            "kind": kind,
            "locator": f"§{section}" + (f", p.{c.get('page')}" if c.get("page") else ""),
            "snippet": c.get("quote") or c.get("snippet") or "Retrieved document evidence.",
            "score": float(c.get("score") or 0.75),
            "chunkId": f"{doc_id}§{section}" if section else str(doc_id),
        })
    return citations


def normalize_tool_calls(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    calls = []
    for i, call in enumerate(raw, 1):
        result = call.get("result") or {}
        trace = result.get("trace") or {}
        error = result.get("error")
        calls.append({
            "id": f"tc-{i}",
            "index": i,
            "toolName": call.get("name") or "unknown_tool",
            "serverId": "alarm-management",
            "status": "ok" if result.get("ok", True) else "error",
            "durationMs": int(trace.get("duration_ms") or 0),
            "attempts": int(trace.get("attempts") or 1),
            "httpStatus": trace.get("status_code"),
            "request": call.get("args") or {},
            "response": result.get("data"),
            "error": error,
            "startedAt": now_iso(),
        })
    return calls


def structured_payload(state: dict[str, Any]) -> dict[str, Any] | None:
    for obs in state.get("observations", []):
        if obs.get("tool") == "structured_mcp_agent":
            return obs.get("data") or {}
    return None


def build_summary(structured: dict[str, Any] | None) -> dict[str, Any] | None:
    if not structured:
        return None
    alarms_payload = (((structured.get("alarms") or {}).get("data") or {}).get("data") or [])
    if not alarms_payload:
        return None
    first = alarms_payload[0]
    by_sev = {sev: 0 for sev in SEVERITIES}
    for alarm in alarms_payload:
        sev = alarm.get("severity", "medium")
        if sev in by_sev:
            by_sev[sev] += 1
    active = sum(1 for alarm in alarms_payload if alarm.get("status") == "active")
    priority_data = ((structured.get("priority") or {}).get("data") or {})
    top_alarm = first.get("alarm_name") or "Unknown alarm"
    avg_delay_seconds = [a.get("ack_delay_seconds") for a in alarms_payload if a.get("ack_delay_seconds") is not None]
    return {
        "assetId": structured.get("asset_id") or first.get("asset_id") or "unknown",
        "assetName": first.get("asset_name") or (structured.get("assets") or [{}])[0].get("asset_name") or "Unknown asset",
        "site": first.get("site") or "Unknown site",
        "unit": first.get("unit") or "Unknown unit",
        "windowLabel": "Last 90 days · simulator data",
        "totalAlarms": len(alarms_payload),
        "activeAlarms": active,
        "bySeverity": by_sev,
        "topAlarmName": top_alarm,
        "recurringRate": 1.0 if any((a.get("metadata") or {}).get("recurring_90d") for a in alarms_payload) else 0.0,
        "avgAckDelayMin": round(sum(avg_delay_seconds) / len(avg_delay_seconds) / 60, 1) if avg_delay_seconds else 0,
        "priorityScore": int(priority_data.get("score") or 0),
    }


def build_causes(structured: dict[str, Any] | None, citations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not structured:
        return []
    out = []
    correlations = (((structured.get("correlation") or {}).get("data") or {}).get("correlations") or [])
    for i, corr in enumerate(correlations[:3], 1):
        out.append({
            "id": f"cause-{i}",
            "title": corr.get("related_alarm_name") or corr.get("explanation") or "Correlated alarm pattern",
            "description": corr.get("explanation") or "Correlation identified in structured alarm data.",
            "confidence": float(corr.get("confidence") or 0.5),
            "evidence": [f"support {corr.get('support_count')}", f"lag {corr.get('lag_minutes')} min"],
            "citationRefs": [1] if citations else [],
        })
    if not out:
        alarms = (((structured.get("alarms") or {}).get("data") or {}).get("data") or [])
        first = alarms[0] if alarms else {}
        if first.get("probable_cause"):
            out.append({
                "id": "cause-1",
                "title": first.get("probable_cause"),
                "description": first.get("message") or first.get("probable_cause"),
                "confidence": 0.66,
                "evidence": ["Alarm probable_cause field"],
                "citationRefs": [1] if citations else [],
            })
    return out


def build_recommendations(structured: dict[str, Any] | None, citations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not structured:
        return []
    recs = (((structured.get("recommendations") or {}).get("data") or {}).get("recommendations") or [])
    out = []
    for i, rec in enumerate(recs, 1):
        out.append({
            "id": rec.get("recommendation_id") or f"rec-{i}",
            "step": i,
            "text": rec.get("action_text") or "Review operator action.",
            "origin": "both" if citations else "api",
            "citationRefs": [1] if citations else [],
            "agreement": "match" if citations else "api-only",
        })
    return out


def normalize_for_compare(text: str) -> str:
    """Lowercase, strip a leading label and any trailing punctuation, for dedupe."""
    body = re.sub(r"^\s*(recommended action|action|document evidence)\s*:\s*", "", text, flags=re.I)
    return re.sub(r"[^a-z0-9]+", " ", body.lower()).strip()


def prune_restated_paragraphs(
    paragraphs: list[str],
    recommendations: list[dict[str, Any]],
    low_confidence: bool,
) -> list[str]:
    """Drop prose the GUI already renders as a dedicated block.

    The orchestrator emits one flat line per finding, so the recommendations and
    the retrieval-failure notice arrive both as prose and as structured fields.
    Rendering both makes the answer read as if it were stuttering.
    """
    already_shown = {normalize_for_compare(r["text"]) for r in recommendations}
    kept = []
    for para in paragraphs:
        key = normalize_for_compare(para)
        if key in already_shown:
            continue
        if low_confidence and re.match(r"^\s*document evidence\s*:", para, flags=re.I):
            continue
        kept.append(para)
    return kept


def answer_block(state: dict[str, Any]) -> dict[str, Any]:
    headline, paragraphs = split_paragraphs(state.get("final_answer", ""))
    citations = normalize_citations(state.get("citations", []))
    structured = structured_payload(state)
    tool_calls = normalize_tool_calls(state.get("mcp_trace", []))
    failed = [c["toolName"] for c in tool_calls if c["status"] == "error"]
    recommendations = build_recommendations(structured, citations)
    low_confidence = any(
        obs.get("tool") == "unstructured_rag_agent" and (obs.get("data") or {}).get("exhausted")
        for obs in state.get("observations", [])
    )
    block: dict[str, Any] = {
        "headline": headline,
        "paragraphs": prune_restated_paragraphs(paragraphs, recommendations, low_confidence),
        "summary": build_summary(structured),
        "causes": build_causes(structured, citations),
        "recommendations": recommendations,
        "citations": citations,
        "toolCalls": tool_calls,
    }
    if failed:
        block["degraded"] = {"reason": "One or more MCP calls failed; answer uses remaining evidence.", "failedTools": failed}
    if low_confidence:
        block["lowConfidence"] = {"reason": "The document RAG agent could not resolve part of the question.", "topScore": 0, "floor": 0.7}
    return block


@web.middleware
async def cors(request: web.Request, handler):
    if request.method == "OPTIONS":
        response = web.Response(status=204)
    else:
        response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = os.getenv("CORS_ORIGIN", "*")
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


async def health(_: web.Request) -> web.Response:
    return web.json_response({"status": "ok", "service": "copilot-backend", "time": now_iso()})


async def options(_: web.Request) -> web.Response:
    return web.Response(status=204)


async def chat(request: web.Request) -> web.Response:
    started = time.monotonic()
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": {"code": "invalid_json", "message": "Request body must be JSON."}}, status=400)
    question = str(body.get("question") or "").strip()
    if not question:
        return web.json_response({"error": {"code": "missing_question", "message": "Field 'question' is required."}}, status=400)
    request_id = body.get("request_id") or f"req-{uuid.uuid4().hex[:12]}"
    conversation_id = body.get("conversation_id") or f"conv-{uuid.uuid4().hex[:12]}"
    try:
        state = await asyncio.to_thread(ask_master, question)
        block = answer_block(dict(state))
        return web.json_response({
            "requestId": request_id,
            "conversationId": conversation_id,
            "createdAt": now_iso(),
            "durationMs": int((time.monotonic() - started) * 1000),
            "answer": block,
            "state": state,
        })
    except Exception as exc:
        return web.json_response({"error": {"code": "orchestrator_error", "message": str(exc)}}, status=500)


def create_app() -> web.Application:
    app = web.Application(middlewares=[cors])
    app.router.add_get("/api/health", health)
    app.router.add_post("/api/chat", chat)
    app.router.add_options("/api/chat", options)
    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the copilot backend API.")
    parser.add_argument("--host", default=os.getenv("BACKEND_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("BACKEND_PORT", "8080")))
    args = parser.parse_args()
    web.run_app(create_app(), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
