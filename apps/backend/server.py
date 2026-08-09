from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from aiohttp import web
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

MCP_PACKAGE = ROOT / "mcp-servers" / "alarm-management"
RAG_RETRIEVAL = ROOT / "rag" / "retrieval"
for path in [ROOT, MCP_PACKAGE, RAG_RETRIEVAL]:
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from apps.backend.agent.master_graph import ask_master  # noqa: E402
from apps.backend.agent.events import reset_event_sink, set_event_sink  # noqa: E402
from apps.backend.agent.graph import relevance_gate  # noqa: E402
from apps.backend.alarm_api.db import connect as connect_alarm_db, rows_to_dicts  # noqa: E402
from retriever import EMBED_MODEL, OVERFETCH, TOP_K, search as search_rag  # noqa: E402

SEVERITIES = ["critical", "high", "medium", "low"]
DOC_KIND_MAP = {
    "operating-procedure": "operating-procedure",
    "maintenance-manual": "maintenance-manual",
    "troubleshooting-guide": "troubleshooting-guide",
    "safety-instruction": "safety-instruction",
    "alarm-philosophy": "alarm-philosophy",
    "knowledge-article": "troubleshooting-guide",
}
UI_DOC_KINDS = {
    "operating-procedure",
    "maintenance-manual",
    "troubleshooting-guide",
    "safety-instruction",
    "alarm-philosophy",
    "knowledge-article",
}
PDF_BY_DOC_ID = {
    "AP-001": ROOT / "rag" / "documents" / "alarm-philosophy" / "AP-001_alarm-philosophy-rationalisation.pdf",
    "KB-3312": ROOT / "rag" / "documents" / "knowledge-articles" / "KB-3312_recurring-pump-alarms.pdf",
    "MM-207": ROOT / "rag" / "documents" / "maintenance-manuals" / "MM-207_centrifugal-pump-maintenance.pdf",
    "SOP-114": ROOT / "rag" / "documents" / "operating-procedures" / "SOP-114_boiler-feed-pump-low-suction-pressure.pdf",
    "SOP-220": ROOT / "rag" / "documents" / "operating-procedures" / "SOP-220_compressor-discharge-pressure-high.pdf",
    "SI-009": ROOT / "rag" / "documents" / "safety-instructions" / "SI-009_isolation-of-rotating-equipment.pdf",
    "TG-051": ROOT / "rag" / "documents" / "troubleshooting-guides" / "TG-051_cavitation-and-npsh.pdf",
    "TG-088": ROOT / "rag" / "documents" / "troubleshooting-guides" / "TG-088_motor-trip-electrical-fault.pdf",
}

STRUCTURED_TABLES = {
    "sites": {
        "title": "Sites",
        "description": "Plant/site master data with region and timezone.",
        "query": "SELECT site_id, name, region, timezone FROM sites ORDER BY name LIMIT ?",
    },
    "units": {
        "title": "Units",
        "description": "Process units linked to sites and process areas.",
        "query": """
            SELECT u.unit_id, u.name AS unit, s.name AS site, u.process_area
            FROM units u
            JOIN sites s ON s.site_id = u.site_id
            ORDER BY s.name, u.name
            LIMIT ?
        """,
    },
    "assets": {
        "title": "Assets",
        "description": "Equipment, instruments, drives and valves available for asset resolution.",
        "query": """
            SELECT a.asset_id, a.asset_name, a.asset_type, s.name AS site, u.name AS unit,
                   a.criticality, a.status
            FROM assets a
            JOIN units u ON u.unit_id = a.unit_id
            JOIN sites s ON s.site_id = u.site_id
            ORDER BY s.name, u.name, a.asset_id
            LIMIT ?
        """,
    },
    "asset_relationships": {
        "title": "Asset Relationships",
        "description": "Upstream/downstream, drive, protection and instrumentation links between assets.",
        "query": """
            SELECT source_asset_id, relationship_type, target_asset_id, description
            FROM asset_relationships
            ORDER BY source_asset_id, relationship_type
            LIMIT ?
        """,
    },
    "alarms": {
        "title": "Alarms",
        "description": "Current and historical alarm records with severity, status, process values and probable causes.",
        "query": """
            SELECT alarm_id, alarm_name, asset_id, severity, status, start_time, probable_cause
            FROM alarms
            ORDER BY start_time DESC
            LIMIT ?
        """,
    },
    "alarm_occurrences": {
        "title": "Alarm Occurrences",
        "description": "Repeated alarm events used for recurrence, chronicity and response-delay analysis.",
        "query": """
            SELECT occurrence_id, alarm_id, occurred_at, cleared_at, severity, ack_delay_seconds, operator_id
            FROM alarm_occurrences
            ORDER BY occurred_at DESC
            LIMIT ?
        """,
    },
    "alarm_correlations": {
        "title": "Alarm Correlations",
        "description": "Related alarm patterns, lag, support count and confidence used for likely-cause analysis.",
        "query": """
            SELECT primary_alarm_id, related_alarm_id, method, support_count, confidence, lag_minutes, explanation
            FROM alarm_correlations
            ORDER BY confidence DESC
            LIMIT ?
        """,
    },
    "priority_scores": {
        "title": "Priority Scores",
        "description": "Computed alarm priority bands and score factors.",
        "query": """
            SELECT alarm_id, score, priority_band, computed_at
            FROM priority_scores
            ORDER BY score DESC
            LIMIT ?
        """,
    },
    "operator_recommendations": {
        "title": "Operator Recommendations",
        "description": "API-side recommended operator actions with urgency, rationale and ranking.",
        "query": """
            SELECT alarm_id, asset_id, rank, urgency, source, action_text
            FROM operator_recommendations
            ORDER BY alarm_id, rank
            LIMIT ?
        """,
    },
    "kpi_definitions": {
        "title": "KPI Definitions",
        "description": "Named alarm-management KPIs and formulas available for summary calculations.",
        "query": "SELECT kpi_name, display_name, unit, formula FROM kpi_definitions ORDER BY kpi_name LIMIT ?",
    },
    "calculation_templates": {
        "title": "Calculation Templates",
        "description": "Whitelisted structured calculations the MCP layer can generate safely.",
        "query": """
            SELECT calculation_type, display_name, description, safe_formula
            FROM calculation_templates
            ORDER BY calculation_type
            LIMIT ?
        """,
    },
    "generated_calculations": {
        "title": "Generated Calculations",
        "description": "Audit table for generated structured calculations.",
        "query": """
            SELECT calculation_id, calculation_type, generated_at, status
            FROM generated_calculations
            ORDER BY generated_at DESC
            LIMIT ?
        """,
    },
    "api_trace_events": {
        "title": "API Trace Events",
        "description": "Observed API/MCP calls for traceability, latency and status-code review.",
        "query": """
            SELECT trace_id, endpoint, method, status_code, duration_ms, created_at
            FROM api_trace_events
            ORDER BY trace_event_id DESC
            LIMIT ?
        """,
    },
}


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def split_paragraphs(text: str) -> tuple[str, list[str]]:
    parts = [p.strip() for p in (text or "").split("\n") if p.strip()]
    if not parts:
        return "Investigation complete", []
    return parts[0], parts[1:] or parts[:1]


def normalize_conversation_context(body: dict[str, Any]) -> dict[str, str]:
    raw = body.get("conversationContext") or body.get("conversation_context") or {}
    if not isinstance(raw, dict):
        return {}
    previous_user = str(raw.get("previousUser") or raw.get("previous_user") or "").strip()
    previous_assistant = str(raw.get("previousAssistant") or raw.get("previous_assistant") or "").strip()
    out = {}
    if previous_user:
        out["previous_user"] = previous_user[:1200]
    if previous_assistant:
        out["previous_assistant"] = previous_assistant[:1800]
    return out


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
            "evidenceText": c.get("evidence_text") or c.get("evidenceText") or c.get("quote") or c.get("snippet") or "Retrieved document evidence.",
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
            "citationRefs": [],
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
                "citationRefs": [],
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
            "origin": "api",
            "citationRefs": [],
            "agreement": "api-only",
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


def _primary_locator(sections: str) -> str:
    first = (sections or "").split("; ")[0]
    if not first:
        return "matched representation"
    try:
        number, title, page = first.split("|")
        return f"§{number}, {title}, {page}"
    except ValueError:
        return first


def _ui_doc_kind(kind: str) -> str:
    normalized = str(kind or "").lower()
    return normalized if normalized in UI_DOC_KINDS else DOC_KIND_MAP.get(normalized, "operating-procedure")


def _knowledge_search_payload(query: str, top_k: int) -> dict[str, Any]:
    docs = search_rag(query, top_k=max(top_k, TOP_K), overfetch=OVERFETCH)
    _, judged = relevance_gate(query, docs)
    by_doc_id = {item["doc_id"]: item for item in judged}

    results = []
    documents = []
    for doc in docs[:top_k]:
        judgement = by_doc_id.get(doc.doc_id, {})
        passed = bool(judgement.get("relevant"))
        reason = str(judgement.get("reason") or "not evaluated")
        locator = _primary_locator(doc.sections)
        documents.append({
            "documentId": doc.doc_id,
            "title": doc.title,
            "kind": _ui_doc_kind(doc.kind),
            "revision": doc.revision,
            "site": doc.site,
            "unit": doc.unit,
            "assetClass": doc.asset_class,
            "sourcePath": doc.source_path,
            "sections": doc.sections,
            "score": round(float(doc.score), 3),
            "matchedRepresentation": doc.matched_representation,
            "passedRelevance": passed,
            "relevanceReason": reason,
            "lexicalOverlap": judgement.get("lexical_overlap"),
            "metadataMatch": judgement.get("metadata_match"),
        })
        results.append({
            "chunkId": f"{doc.doc_id}#matched",
            "documentId": doc.doc_id,
            "documentTitle": doc.title,
            "kind": _ui_doc_kind(doc.kind),
            "locator": locator,
            "text": doc.matched_representation,
            "score": round(float(doc.score), 3),
            "tokens": len(doc.matched_representation.split()),
            "passedRelevance": passed,
            "relevanceReason": reason,
            "matchedRepresentation": doc.matched_representation,
        })

    return {
        "query": query,
        "embeddingModel": EMBED_MODEL,
        "overfetch": OVERFETCH,
        "topK": top_k,
        "documents": documents,
        "results": results,
    }


async def knowledge_search(request: web.Request) -> web.Response:
    if request.method == "POST":
        try:
            body = await request.json()
        except Exception:
            return web.json_response({"error": {"code": "invalid_json", "message": "Request body must be JSON."}}, status=400)
        query = str(body.get("query") or body.get("q") or "").strip()
        raw_top_k = body.get("topK") or body.get("top_k") or TOP_K
    else:
        query = str(request.query.get("q") or request.query.get("query") or "").strip()
        raw_top_k = request.query.get("topK") or request.query.get("top_k") or TOP_K

    if not query:
        return web.json_response({"error": {"code": "missing_query", "message": "Query parameter 'q' is required."}}, status=400)

    try:
        top_k = max(1, min(8, int(raw_top_k)))
    except (TypeError, ValueError):
        top_k = TOP_K

    try:
        payload = await asyncio.to_thread(_knowledge_search_payload, query, top_k)
        return web.json_response(payload)
    except Exception as exc:
        return web.json_response({"error": {"code": "knowledge_search_error", "message": str(exc)}}, status=500)


async def knowledge_pdf(request: web.Request) -> web.StreamResponse:
    doc_id = str(request.match_info.get("doc_id") or "").upper()
    pdf_path = PDF_BY_DOC_ID.get(doc_id)
    if not pdf_path or not pdf_path.exists():
        return web.json_response({"error": {"code": "document_not_found", "message": "PDF document was not found."}}, status=404)
    return web.FileResponse(
        path=pdf_path,
        headers={
            "Content-Type": "application/pdf",
            "Content-Disposition": f'inline; filename="{pdf_path.name}"',
        },
    )


def _table_columns(conn, table_name: str) -> list[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return [str(row["name"]) for row in rows]


def _structured_preview_payload(sample_size: int) -> dict[str, Any]:
    sample_size = max(1, min(10, sample_size))
    tables = []

    with connect_alarm_db() as conn:
        for table_name, config in STRUCTURED_TABLES.items():
            row_count = conn.execute(f"SELECT COUNT(*) AS count FROM {table_name}").fetchone()["count"]
            preview_rows = conn.execute(config["query"], (sample_size,)).fetchall()
            samples = rows_to_dicts(preview_rows)
            columns = list(samples[0].keys()) if samples else _table_columns(conn, table_name)
            tables.append({
                "name": table_name,
                "title": config["title"],
                "description": config["description"],
                "rowCount": int(row_count),
                "columns": columns,
                "sampleRows": samples,
            })

    return {
        "source": "alarm_management.sqlite3",
        "description": "SQLite seed database behind the Alarm Management API simulator and structured MCP agent.",
        "sampleSize": sample_size,
        "tables": tables,
    }


async def structured_preview(request: web.Request) -> web.Response:
    raw_limit = request.query.get("sampleSize") or request.query.get("sample_size") or 5
    try:
        sample_size = int(raw_limit)
    except (TypeError, ValueError):
        sample_size = 5

    try:
        payload = await asyncio.to_thread(_structured_preview_payload, sample_size)
        return web.json_response(payload)
    except Exception as exc:
        return web.json_response({"error": {"code": "structured_preview_error", "message": str(exc)}}, status=500)


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
    conversation_context = normalize_conversation_context(body)
    try:
        state = await asyncio.to_thread(ask_master, question, conversation_context)
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


async def write_sse(response: web.StreamResponse, event_name: str, payload: dict[str, Any]) -> None:
    await response.write(f"event: {event_name}\ndata: {json.dumps(payload, default=str)}\n\n".encode("utf-8"))


def stream_headers() -> dict[str, str]:
    return {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": os.getenv("CORS_ORIGIN", "*"),
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    }


async def chat_stream(request: web.Request) -> web.StreamResponse:
    started = time.monotonic()
    try:
        body = await request.json()
    except Exception:
        response = web.StreamResponse(status=400, headers=stream_headers())
        await response.prepare(request)
        await write_sse(response, "error", {"code": "invalid_json", "message": "Request body must be JSON."})
        await response.write_eof()
        return response

    question = str(body.get("question") or "").strip()
    request_id = body.get("request_id") or f"req-{uuid.uuid4().hex[:12]}"
    conversation_id = body.get("conversation_id") or f"conv-{uuid.uuid4().hex[:12]}"
    conversation_context = normalize_conversation_context(body)

    response = web.StreamResponse(status=200, headers=stream_headers())
    await response.prepare(request)

    if not question:
        await write_sse(response, "error", {"code": "missing_question", "message": "Field 'question' is required."})
        await response.write_eof()
        return response

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    def sink(event: dict[str, Any]) -> None:
        payload = dict(event)
        payload.setdefault("id", f"step-{uuid.uuid4().hex[:10]}")
        payload.setdefault("createdAt", now_iso())
        asyncio.run_coroutine_threadsafe(queue.put(payload), loop)

    def run_with_events() -> dict[str, Any]:
        token = set_event_sink(sink)
        try:
            return dict(ask_master(question, conversation_context))
        finally:
            reset_event_sink(token)

    worker = asyncio.create_task(asyncio.to_thread(run_with_events))
    last_heartbeat = time.monotonic()

    while not worker.done() or not queue.empty():
        try:
            event = await asyncio.wait_for(queue.get(), timeout=0.5)
            await write_sse(response, event.get("type", "message"), event)
        except asyncio.TimeoutError:
            if time.monotonic() - last_heartbeat > 15:
                await response.write(b": heartbeat\n\n")
                last_heartbeat = time.monotonic()

    try:
        state = await worker
        block = answer_block(state)
        await write_sse(response, "answer.completed", {
            "requestId": request_id,
            "conversationId": conversation_id,
            "createdAt": now_iso(),
            "durationMs": int((time.monotonic() - started) * 1000),
            "answer": block,
            "state": state,
        })
    except Exception as exc:
        await write_sse(response, "error", {"code": "orchestrator_error", "message": str(exc)})

    await response.write_eof()
    return response


def create_app() -> web.Application:
    app = web.Application(middlewares=[cors])
    app.router.add_get("/api/health", health)
    app.router.add_get("/api/knowledge/search", knowledge_search)
    app.router.add_post("/api/knowledge/search", knowledge_search)
    app.router.add_options("/api/knowledge/search", options)
    app.router.add_get("/api/knowledge/documents/{doc_id}/pdf", knowledge_pdf)
    app.router.add_options("/api/knowledge/documents/{doc_id}/pdf", options)
    app.router.add_get("/api/structured/preview", structured_preview)
    app.router.add_options("/api/structured/preview", options)
    app.router.add_post("/api/chat", chat)
    app.router.add_options("/api/chat", options)
    app.router.add_post("/api/chat/stream", chat_stream)
    app.router.add_options("/api/chat/stream", options)
    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the copilot backend API.")
    parser.add_argument("--host", default=os.getenv("BACKEND_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("BACKEND_PORT", "8080")))
    args = parser.parse_args()
    web.run_app(create_app(), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
