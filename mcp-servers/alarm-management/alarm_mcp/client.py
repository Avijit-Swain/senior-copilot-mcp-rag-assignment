from __future__ import annotations

import os
import time
import uuid
from dataclasses import dataclass
from typing import Any

import httpx
from pydantic import BaseModel

from .schemas import TraceContext, ToolResult


class AlarmApiError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None, payload: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


@dataclass(frozen=True)
class AlarmApiConfig:
    base_url: str
    token: str
    timeout_seconds: float = 15.0
    max_retries: int = 2

    @classmethod
    def from_env(cls) -> "AlarmApiConfig":
        timeout_ms = int(os.getenv("MCP_TOOL_TIMEOUT_MS", "15000"))
        return cls(
            base_url=os.getenv("ALARM_API_BASE_URL", "http://127.0.0.1:8000").rstrip("/"),
            token=os.getenv("ALARM_API_TOKEN", "demo-token"),
            timeout_seconds=timeout_ms / 1000,
            max_retries=int(os.getenv("MCP_TOOL_MAX_RETRIES", "2")),
        )


class AlarmApiClient:
    def __init__(self, config: AlarmApiConfig | None = None) -> None:
        self.config = config or AlarmApiConfig.from_env()

    def _headers(self, trace: TraceContext | None = None) -> dict[str, str]:
        ctx = trace or TraceContext()
        headers = {"Authorization": f"Bearer {self.config.token}"}
        headers["trace_id"] = ctx.trace_id or f"trace-{uuid.uuid4().hex[:12]}"
        headers["x-client-id"] = ctx.client_id
        if ctx.metadata_tag:
            headers["x-metadata-tag"] = ctx.metadata_tag
        return headers

    def _request(self, method: str, path: str, *, trace: TraceContext | None = None, params: dict[str, Any] | None = None, json_body: dict[str, Any] | None = None) -> ToolResult:
        url = f"{self.config.base_url}{path}"
        started = time.monotonic()
        attempts = 0
        last_error: dict[str, Any] | None = None
        for attempt in range(self.config.max_retries + 1):
            attempts = attempt + 1
            try:
                with httpx.Client(timeout=self.config.timeout_seconds) as client:
                    response = client.request(method, url, headers=self._headers(trace), params=params, json=json_body)
                duration_ms = int((time.monotonic() - started) * 1000)
                payload = response.json() if response.content else None
                trace_payload = {"method": method, "url": url, "status_code": response.status_code, "duration_ms": duration_ms, "attempts": attempts}
                if 200 <= response.status_code < 300:
                    return ToolResult(ok=True, tool=path, data=payload, error=None, trace=trace_payload)
                last_error = {"code": "alarm_api_error", "message": "Alarm API returned an error response.", "status_code": response.status_code, "payload": payload}
                if response.status_code < 500:
                    return ToolResult(ok=False, tool=path, data=None, error=last_error, trace=trace_payload)
            except httpx.TimeoutException as exc:
                last_error = {"code": "timeout", "message": str(exc)}
            except httpx.HTTPError as exc:
                last_error = {"code": "transport_error", "message": str(exc)}
        duration_ms = int((time.monotonic() - started) * 1000)
        return ToolResult(ok=False, tool=path, data=None, error=last_error or {"code": "unknown_error"}, trace={"method": method, "url": url, "duration_ms": duration_ms, "attempts": attempts})

    @staticmethod
    def _dump(model: BaseModel) -> dict[str, Any]:
        return model.model_dump(exclude={"trace"}, exclude_none=True)

    def search_assets(self, args) -> ToolResult:
        params = self._dump(args)
        return self._request("GET", "/assets/search", trace=args.trace, params=params)

    def get_asset_metadata(self, args) -> ToolResult:
        return self._request("GET", f"/assets/{args.asset_id}/metadata", trace=args.trace)

    def get_alarms(self, args) -> ToolResult:
        return self._request("GET", "/alarms", trace=args.trace, params=self._dump(args))

    def get_alarm_summary(self, args) -> ToolResult:
        return self._request("POST", "/alarms/summary", trace=args.trace, json_body=self._dump(args))

    def correlate_alarms(self, args) -> ToolResult:
        return self._request("POST", "/alarms/correlation", trace=args.trace, json_body=self._dump(args))

    def score_alarm_priority(self, args) -> ToolResult:
        return self._request("POST", "/alarms/priority-score", trace=args.trace, json_body=self._dump(args))

    def get_operator_recommendations(self, args) -> ToolResult:
        return self._request("POST", "/recommendations/operator-actions", trace=args.trace, json_body=self._dump(args))
