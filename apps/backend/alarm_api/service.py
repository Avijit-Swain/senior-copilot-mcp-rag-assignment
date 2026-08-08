from __future__ import annotations

import json
import math
import sqlite3
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from aiohttp import web

from .db import connect, row_to_dict, rows_to_dicts

TOKEN = "demo-token"
SEVERITY_RANK = {"medium": 1, "high": 2, "critical": 3}


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_json(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def json_response(data: Any, status: int = 200) -> web.Response:
    return web.json_response(data, status=status)


@web.middleware
async def auth_and_trace(request: web.Request, handler):
    start = time.monotonic()
    if request.path != "/health":
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {TOKEN}":
            return json_response({"error": {"code": "unauthorized", "message": "Missing or invalid bearer token."}}, 401)
    try:
        response = await handler(request)
        status = response.status
        return response
    except web.HTTPException as exc:
        status = exc.status
        raise
    finally:
        if request.path != "/health":
            duration = int((time.monotonic() - start) * 1000)
            trace_id = request.headers.get("trace_id") or request.headers.get("x-trace-id") or str(uuid.uuid4())
            client_id = request.headers.get("x-client-id")
            metadata_tag = request.headers.get("x-metadata-tag")
            try:
                request_json = dict(request.query)
                if request.can_read_body:
                    cached = getattr(request, "_cached_body", None)
                    if cached:
                        request_json["body"] = parse_json(cached.decode("utf-8"), cached.decode("utf-8"))
                with connect() as conn:
                    conn.execute(
                        """
                        INSERT INTO api_trace_events(trace_id, client_id, metadata_tag, endpoint, method, status_code, duration_ms, request_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (trace_id, client_id, metadata_tag, request.path, request.method, status, duration, json.dumps(request_json)),
                    )
            except Exception:
                pass


async def read_body(request: web.Request) -> dict[str, Any]:
    body = await request.read()
    request._cached_body = body
    if not body:
        return {}
    try:
        return json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise web.HTTPBadRequest(text=json.dumps({"error": {"code": "invalid_json", "message": "Request body must be valid JSON."}}), content_type="application/json")


def time_clause(params: dict[str, Any], values: list[Any], column: str = "a.start_time") -> str:
    clauses = []
    start = params.get("start_time") or params.get("time_range", {}).get("start_time") if isinstance(params.get("time_range"), dict) else params.get("start_time")
    end = params.get("end_time") or params.get("time_range", {}).get("end_time") if isinstance(params.get("time_range"), dict) else params.get("end_time")
    if start:
        clauses.append(f"{column} >= ?")
        values.append(start)
    if end:
        clauses.append(f"{column} <= ?")
        values.append(end)
    return " AND ".join(clauses)


def alarm_base_sql() -> str:
    return """
        SELECT a.*, assets.asset_name, assets.asset_type, assets.tag, units.name AS unit, sites.name AS site
        FROM alarms a
        JOIN assets ON assets.asset_id = a.asset_id
        JOIN units ON units.unit_id = assets.unit_id
        JOIN sites ON sites.site_id = units.site_id
    """


async def health(_: web.Request) -> web.Response:
    return json_response({"status": "ok", "service": "alarm-api-simulator", "time": utc_now()})


async def search_assets(request: web.Request) -> web.Response:
    q = request.query.get("query", "").strip().lower()
    site = request.query.get("site")
    unit = request.query.get("unit")
    limit = min(int(request.query.get("limit", "10")), 50)
    values: list[Any] = []
    clauses = []
    if q:
        clauses.append("(lower(assets.asset_name) LIKE ? OR lower(assets.tag) LIKE ? OR lower(assets.asset_type) LIKE ?)")
        like = f"%{q}%"
        values.extend([like, like, like])
    if site:
        clauses.append("sites.name = ?")
        values.append(site)
    if unit:
        clauses.append("units.name = ?")
        values.append(unit)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT assets.asset_id, assets.asset_name, assets.asset_type, assets.tag, assets.criticality, assets.status,
                   units.name AS unit, sites.name AS site
            FROM assets
            JOIN units ON units.unit_id = assets.unit_id
            JOIN sites ON sites.site_id = units.site_id
            {where}
            ORDER BY CASE WHEN lower(assets.asset_name)=? THEN 0 ELSE 1 END, assets.asset_name
            LIMIT ?
            """,
            values + [q, limit],
        ).fetchall()
    return json_response({"results": rows_to_dicts(rows), "count": len(rows)})


async def asset_metadata(request: web.Request) -> web.Response:
    asset_id = request.match_info["asset_id"]
    with connect() as conn:
        row = conn.execute(
            """
            SELECT assets.*, units.name AS unit, units.process_area, sites.name AS site, sites.region
            FROM assets
            JOIN units ON units.unit_id = assets.unit_id
            JOIN sites ON sites.site_id = units.site_id
            WHERE assets.asset_id = ?
            """,
            (asset_id,),
        ).fetchone()
        if not row:
            return json_response({"error": {"code": "asset_not_found", "message": f"Asset {asset_id} was not found."}}, 404)
        rels = conn.execute(
            """
            SELECT ar.relationship_type, ar.description, target.asset_id, target.asset_name, target.asset_type, target.tag
            FROM asset_relationships ar
            JOIN assets target ON target.asset_id = ar.target_asset_id
            WHERE ar.source_asset_id = ?
            ORDER BY ar.relationship_type, target.asset_name
            """,
            (asset_id,),
        ).fetchall()
    asset = row_to_dict(row) or {}
    asset["related_assets"] = rows_to_dicts(rels)
    return json_response(asset)


async def list_alarms(request: web.Request) -> web.Response:
    values: list[Any] = []
    clauses = []
    for key, col in [("asset_id", "a.asset_id"), ("site", "sites.name"), ("unit", "units.name"), ("status", "a.status")]:
        val = request.query.get(key)
        if val:
            clauses.append(f"{col} = ?")
            values.append(val)
    tr = time_clause(dict(request.query), values)
    if tr:
        clauses.append(tr)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    page = max(int(request.query.get("page", "1")), 1)
    page_size = min(max(int(request.query.get("page_size", "50")), 1), 100)
    sort_by = request.query.get("sort_by", "start_time")
    sort_col = {"start_time": "a.start_time", "severity": "a.severity", "alarm_name": "a.alarm_name"}.get(sort_by, "a.start_time")
    sort_order = "ASC" if request.query.get("sort_order", "desc").lower() == "asc" else "DESC"
    with connect() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM ({alarm_base_sql()} {where})", values).fetchone()[0]
        rows = conn.execute(
            f"{alarm_base_sql()} {where} ORDER BY {sort_col} {sort_order} LIMIT ? OFFSET ?",
            values + [page_size, (page - 1) * page_size],
        ).fetchall()
    return json_response({"data": rows_to_dicts(rows), "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": math.ceil(total / page_size) if page_size else 0}})


async def get_alarm(request: web.Request) -> web.Response:
    alarm_id = request.match_info["alarm_id"]
    with connect() as conn:
        row = conn.execute(f"{alarm_base_sql()} WHERE a.alarm_id = ?", (alarm_id,)).fetchone()
        if not row:
            return json_response({"error": {"code": "alarm_not_found", "message": f"Alarm {alarm_id} was not found."}}, 404)
        occ = conn.execute("SELECT * FROM alarm_occurrences WHERE alarm_id = ? ORDER BY occurred_at DESC", (alarm_id,)).fetchall()
    alarm = row_to_dict(row) or {}
    alarm["occurrences"] = rows_to_dicts(occ)
    return json_response(alarm)


def filtered_alarms(conn: sqlite3.Connection, body: dict[str, Any]) -> list[dict[str, Any]]:
    values: list[Any] = []
    clauses = []
    ids = body.get("asset_ids") or []
    if ids:
        clauses.append("a.asset_id IN (%s)" % ",".join("?" for _ in ids))
        values.extend(ids)
    sev = body.get("severity") or []
    if sev:
        clauses.append("a.severity IN (%s)" % ",".join("?" for _ in sev))
        values.extend(sev)
    tr = time_clause(body, values)
    if tr:
        clauses.append(tr)
    if body.get("unit"):
        clauses.append("units.name = ?")
        values.append(body["unit"])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(f"{alarm_base_sql()} {where}", values).fetchall()
    return rows_to_dicts(rows)


async def alarm_summary(request: web.Request) -> web.Response:
    body = await read_body(request)
    group_by = body.get("group_by") or ["alarm_name"]
    kpis = body.get("kpis") or ["alarm_count"]
    with connect() as conn:
        alarms = filtered_alarms(conn, body)
        occ_counts = {r["alarm_id"]: r["count"] for r in conn.execute("SELECT alarm_id, COUNT(*) AS count FROM alarm_occurrences GROUP BY alarm_id").fetchall()}
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    key_name = group_by[0] if group_by else "alarm_name"
    for alarm in alarms:
        groups[str(alarm.get(key_name, alarm["alarm_name"]))].append(alarm)
    result = []
    for key, items in groups.items():
        row: dict[str, Any] = {key_name: key}
        if "alarm_count" in kpis:
            row["alarm_count"] = len(items)
        if "recurring_rate" in kpis:
            row["recurring_rate"] = round(sum(1 for a in items if occ_counts.get(a["alarm_id"], 0) > 1) / len(items), 3) if items else 0
        if "avg_ack_delay" in kpis:
            delays = [a["ack_delay_seconds"] for a in items if a.get("ack_delay_seconds") is not None]
            row["avg_ack_delay"] = round(sum(delays) / len(delays), 1) if delays else None
        result.append(row)
    return json_response({"summary": result, "total_alarms": len(alarms), "filters": body})


async def alarm_trends(request: web.Request) -> web.Response:
    body = await read_body(request)
    bucket = body.get("bucket", "daily")
    with connect() as conn:
        alarms = filtered_alarms(conn, body)
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for alarm in alarms:
        key = alarm["start_time"][:10] if bucket == "daily" else alarm["start_time"][:7]
        buckets[key].append(alarm)
    points = []
    for key in sorted(buckets):
        items = buckets[key]
        delays = [a["ack_delay_seconds"] for a in items if a.get("ack_delay_seconds")]
        points.append({"bucket_start": key, "alarm_count": len(items), "avg_ack_delay": round(sum(delays) / len(delays), 1) if delays else None})
    return json_response({"bucket": bucket, "points": points})


async def alarm_correlation(request: web.Request) -> web.Response:
    body = await read_body(request)
    ids = body.get("asset_ids") or []
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT c.*, p.alarm_name AS primary_alarm_name, r.alarm_name AS related_alarm_name,
                   p.asset_id AS primary_asset_id, r.asset_id AS related_asset_id
            FROM alarm_correlations c
            JOIN alarms p ON p.alarm_id = c.primary_alarm_id
            JOIN alarms r ON r.alarm_id = c.related_alarm_id
            WHERE (? = '' OR p.asset_id IN (%s) OR r.asset_id IN (%s))
            ORDER BY c.confidence DESC
            """ % (",".join("?" for _ in ids) or "''", ",".join("?" for _ in ids) or "''"),
            (["" if not ids else "has_ids"] + ids + ids),
        ).fetchall()
    return json_response({"correlation_method": body.get("correlation_method", "cooccurrence"), "correlations": rows_to_dicts(rows)})


async def flood_analysis(request: web.Request) -> web.Response:
    body = await read_body(request)
    unit = body.get("unit")
    threshold = int(body.get("threshold_count", 10))
    body2 = {"unit": unit, "time_range": body.get("time_range", {})}
    with connect() as conn:
        alarms = filtered_alarms(conn, body2)
    count = len(alarms)
    windows = []
    if count >= threshold or count > 0:
        starts = sorted(a["start_time"] for a in alarms)
        if starts:
            windows.append({"start": starts[0], "end": starts[-1], "alarm_count": count, "threshold_count": threshold})
    return json_response({"flood_windows": windows, "rolling_window_minutes": body.get("rolling_window_minutes", 10), "total_alarms": count})


async def rationalization_candidates(request: web.Request) -> web.Response:
    body = await read_body(request)
    threshold = int(body.get("recurrence_threshold", 5))
    with connect() as conn:
        alarms = filtered_alarms(conn, body)
        counts = {r["alarm_id"]: r["count"] for r in conn.execute("SELECT alarm_id, COUNT(*) AS count FROM alarm_occurrences GROUP BY alarm_id").fetchall()}
    candidates = []
    for alarm in alarms:
        recurrence = counts.get(alarm["alarm_id"], 0)
        if recurrence >= threshold or alarm["status"] in {"active", "acknowledged"}:
            candidates.append({"alarm_id": alarm["alarm_id"], "alarm_name": alarm["alarm_name"], "asset_id": alarm["asset_id"], "recurrence_count": recurrence, "recommendation": "review_priority_and_suppression_rules"})
    return json_response({"candidates": candidates, "count": len(candidates)})


async def priority_score(request: web.Request) -> web.Response:
    body = await read_body(request)
    alarm_id = body.get("alarm_id")
    with connect() as conn:
        row = conn.execute("SELECT * FROM priority_scores WHERE alarm_id = ? ORDER BY computed_at DESC LIMIT 1", (alarm_id,)).fetchone()
        if not row:
            alarm = conn.execute("SELECT severity, status FROM alarms WHERE alarm_id = ?", (alarm_id,)).fetchone()
            if not alarm:
                return json_response({"error": {"code": "alarm_not_found", "message": f"Alarm {alarm_id} was not found."}}, 404)
            base = SEVERITY_RANK[alarm["severity"]] * 20 + (10 if alarm["status"] == "active" else 0)
            return json_response({"alarm_id": alarm_id, "score": base, "priority_band": "high" if base >= 60 else "medium", "factors": {"computed": True}})
    return json_response(row_to_dict(row))


async def operator_actions(request: web.Request) -> web.Response:
    body = await read_body(request)
    alarm_id = body.get("alarm_id")
    with connect() as conn:
        rows = conn.execute("SELECT * FROM operator_recommendations WHERE alarm_id = ? ORDER BY rank", (alarm_id,)).fetchall()
        alarm = conn.execute(f"{alarm_base_sql()} WHERE a.alarm_id = ?", (alarm_id,)).fetchone()
        if not alarm:
            return json_response({"error": {"code": "alarm_not_found", "message": f"Alarm {alarm_id} was not found."}}, 404)
    return json_response({"alarm": row_to_dict(alarm), "recommendations": rows_to_dicts(rows), "include_related": bool(body.get("include_related", True))})


async def generate_calculation(request: web.Request) -> web.Response:
    body = await read_body(request)
    calc_type = body.get("calculation_type")
    with connect() as conn:
        template = conn.execute("SELECT * FROM calculation_templates WHERE calculation_type = ?", (calc_type,)).fetchone()
        if not template:
            return json_response({"error": {"code": "unsupported_calculation", "message": "Only registered calculation templates can be generated."}}, 400)
        calc_id = f"calc-{uuid.uuid4().hex[:12]}"
        conn.execute("INSERT INTO generated_calculations(calculation_id, calculation_type, request_json, generated_at) VALUES (?, ?, ?, ?)", (calc_id, calc_type, json.dumps(body), utc_now()))
    return json_response({"calculation_id": calc_id, "calculation_type": calc_type, "safe_formula": template["safe_formula"]})


async def execute_calculation(request: web.Request) -> web.Response:
    body = await read_body(request)
    calc_id = body.get("calculation_id")
    with connect() as conn:
        calc = conn.execute("SELECT * FROM generated_calculations WHERE calculation_id = ?", (calc_id,)).fetchone()
        if not calc:
            return json_response({"error": {"code": "calculation_not_found", "message": f"Calculation {calc_id} was not found."}}, 404)
        filters = body.get("filters") or parse_json(calc["request_json"], {}).get("filters", {})
        alarms = filtered_alarms(conn, {"unit": filters.get("unit"), "time_range": {"start_time": filters.get("start_time"), "end_time": filters.get("end_time")}})
        conn.execute("UPDATE generated_calculations SET status = 'executed' WHERE calculation_id = ?", (calc_id,))
    calc_type = calc["calculation_type"]
    critical = sum(1 for a in alarms if a["severity"] == "critical")
    avg_delay = sum((a.get("ack_delay_seconds") or 0) for a in alarms) / len(alarms) if alarms else 0
    if calc_type == "alarm_flood_index":
        result = {"alarm_flood_index": round(len(alarms) / max(int(filters.get("rolling_window_minutes", 10)), 1), 3), "alarm_count": len(alarms)}
    elif calc_type == "critical_alarm_density":
        result = {"critical_alarm_density": critical, "critical_count": critical}
    elif calc_type == "operator_response_efficiency":
        result = {"operator_response_efficiency": round(300 / avg_delay, 3) if avg_delay else None, "avg_ack_delay": avg_delay}
    else:
        result = {"nuisance_alarm_score": round(len(alarms) * 0.2 + avg_delay / 600, 3), "alarm_count": len(alarms)}
    return json_response({"calculation_id": calc_id, "calculation_type": calc_type, "result": result})


async def kpi_definitions(_: web.Request) -> web.Response:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM kpi_definitions ORDER BY kpi_name").fetchall()
    return json_response({"kpis": rows_to_dicts(rows)})


def create_app() -> web.Application:
    app = web.Application(middlewares=[auth_and_trace])
    app.router.add_get("/health", health)
    app.router.add_get("/assets/search", search_assets)
    app.router.add_get("/assets/{asset_id}/metadata", asset_metadata)
    app.router.add_get("/alarms", list_alarms)
    app.router.add_get("/alarms/{alarm_id}", get_alarm)
    app.router.add_post("/alarms/summary", alarm_summary)
    app.router.add_post("/alarms/trends", alarm_trends)
    app.router.add_post("/alarms/correlation", alarm_correlation)
    app.router.add_post("/alarms/flood-analysis", flood_analysis)
    app.router.add_post("/alarms/rationalization-candidates", rationalization_candidates)
    app.router.add_post("/alarms/priority-score", priority_score)
    app.router.add_post("/recommendations/operator-actions", operator_actions)
    app.router.add_post("/calculation-code/generate", generate_calculation)
    app.router.add_post("/calculation-code/execute", execute_calculation)
    app.router.add_get("/analytics/kpi-definitions", kpi_definitions)
    return app
