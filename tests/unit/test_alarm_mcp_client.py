from __future__ import annotations

from unittest.mock import Mock, patch

import httpx

from alarm_mcp.client import AlarmApiClient, AlarmApiConfig
from alarm_mcp.schemas import GetAlarmsInput, SearchAssetsInput, TraceContext


def test_search_assets_builds_auth_and_trace_headers() -> None:
    response = httpx.Response(200, json={"results": [{"asset_id": "BFP-101"}]})
    captured = {}

    def fake_request(self, method, url, **kwargs):
        captured.update({"method": method, "url": url, **kwargs})
        return response

    with patch.object(httpx.Client, "request", fake_request):
        client = AlarmApiClient(AlarmApiConfig(base_url="http://alarm-api", token="demo-token"))
        result = client.search_assets(SearchAssetsInput(query="Boiler Feed Pump 101", trace=TraceContext(trace_id="trace-1", client_id="test-client")))

    assert result.ok is True
    assert captured["method"] == "GET"
    assert captured["url"] == "http://alarm-api/assets/search"
    assert captured["headers"]["Authorization"] == "Bearer demo-token"
    assert captured["headers"]["trace_id"] == "trace-1"
    assert captured["headers"]["x-client-id"] == "test-client"
    assert captured["params"]["query"] == "Boiler Feed Pump 101"


def test_get_alarms_maps_non_2xx_to_tool_error() -> None:
    response = httpx.Response(404, json={"error": {"code": "asset_not_found"}})
    with patch.object(httpx.Client, "request", Mock(return_value=response)):
        client = AlarmApiClient(AlarmApiConfig(base_url="http://alarm-api", token="demo-token"))
        result = client.get_alarms(GetAlarmsInput(asset_id="missing"))

    assert result.ok is False
    assert result.error is not None
    assert result.error["status_code"] == 404
    assert result.trace["status_code"] == 404
