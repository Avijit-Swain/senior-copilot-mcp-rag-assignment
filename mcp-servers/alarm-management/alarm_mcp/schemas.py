from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

Severity = Literal["medium", "high", "critical"]
SortOrder = Literal["asc", "desc"]


class TimeRange(BaseModel):
    start_time: str | None = Field(default=None, description="ISO-8601 inclusive start time.")
    end_time: str | None = Field(default=None, description="ISO-8601 inclusive end time.")


class TraceContext(BaseModel):
    trace_id: str | None = None
    client_id: str = "alarm-mcp-server"
    metadata_tag: str | None = None


class SearchAssetsInput(BaseModel):
    query: str = Field(min_length=1, description="Free-text asset query, tag, or asset type.")
    site: str | None = None
    unit: str | None = None
    limit: int = Field(default=10, ge=1, le=50)
    trace: TraceContext = Field(default_factory=TraceContext)


class GetAssetMetadataInput(BaseModel):
    asset_id: str = Field(min_length=1)
    trace: TraceContext = Field(default_factory=TraceContext)


class GetAlarmsInput(BaseModel):
    asset_id: str | None = None
    site: str | None = None
    unit: str | None = None
    status: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)
    sort_by: str = "start_time"
    sort_order: SortOrder = "desc"
    trace: TraceContext = Field(default_factory=TraceContext)


class AlarmSummaryInput(BaseModel):
    asset_ids: list[str] = Field(default_factory=list)
    time_range: TimeRange = Field(default_factory=TimeRange)
    severity: list[Severity] = Field(default_factory=lambda: ["high", "critical"])
    group_by: list[str] = Field(default_factory=lambda: ["alarm_name"])
    kpis: list[str] = Field(default_factory=lambda: ["alarm_count", "recurring_rate", "avg_ack_delay"])
    trace: TraceContext = Field(default_factory=TraceContext)


class CorrelateAlarmsInput(BaseModel):
    asset_ids: list[str] = Field(min_length=1)
    time_range: TimeRange = Field(default_factory=TimeRange)
    correlation_method: str = "cooccurrence"
    lag_window_minutes: int = Field(default=15, ge=1, le=1440)
    severity_threshold: Severity = "medium"
    min_support: int = Field(default=1, ge=1)
    trace: TraceContext = Field(default_factory=TraceContext)


class ScoreAlarmPriorityInput(BaseModel):
    alarm_id: str = Field(min_length=1)
    trace: TraceContext = Field(default_factory=TraceContext)


class OperatorRecommendationsInput(BaseModel):
    alarm_id: str = Field(min_length=1)
    include_related: bool = True
    include_asset_context: bool = True
    include_historical_pattern: bool = True
    trace: TraceContext = Field(default_factory=TraceContext)


class ToolResult(BaseModel):
    ok: bool
    tool: str
    data: Any | None = None
    error: dict[str, Any] | None = None
    trace: dict[str, Any]
