from __future__ import annotations

from mcp.server.mcpserver.server import MCPServer

from .client import AlarmApiClient
from .schemas import (
    AlarmSummaryInput,
    CorrelateAlarmsInput,
    GetAlarmsInput,
    GetAssetMetadataInput,
    OperatorRecommendationsInput,
    ScoreAlarmPriorityInput,
    SearchAssetsInput,
)

mcp = MCPServer("alarm-management")
client = AlarmApiClient()


def as_dict(result):
    return result.model_dump(exclude_none=True)


@mcp.tool(description="Search alarm-management assets by name, tag, type, site, or unit. Use first to resolve natural-language asset names into asset IDs.")
def search_assets(args: SearchAssetsInput) -> dict:
    return as_dict(client.search_assets(args))


@mcp.tool(description="Fetch asset metadata, process context, and related assets for a resolved asset ID.")
def get_asset_metadata(args: GetAssetMetadataInput) -> dict:
    return as_dict(client.get_asset_metadata(args))


@mcp.tool(description="Retrieve active or historical alarms with pagination, time filters, status filters, and sorting.")
def get_alarms(args: GetAlarmsInput) -> dict:
    return as_dict(client.get_alarms(args))


@mcp.tool(description="Calculate alarm summary KPIs such as alarm count, recurrence rate, and average acknowledgement delay.")
def get_alarm_summary(args: AlarmSummaryInput) -> dict:
    return as_dict(client.get_alarm_summary(args))


@mcp.tool(description="Find correlated alarms for one or more assets using the simulator correlation endpoint.")
def correlate_alarms(args: CorrelateAlarmsInput) -> dict:
    return as_dict(client.correlate_alarms(args))


@mcp.tool(description="Score an alarm priority and explain contributing factors.")
def score_alarm_priority(args: ScoreAlarmPriorityInput) -> dict:
    return as_dict(client.score_alarm_priority(args))


@mcp.tool(description="Get operator action recommendations for an alarm, optionally including related asset and historical context.")
def get_operator_recommendations(args: OperatorRecommendationsInput) -> dict:
    return as_dict(client.get_operator_recommendations(args))


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
