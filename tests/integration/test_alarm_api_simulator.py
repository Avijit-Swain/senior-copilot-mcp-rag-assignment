from __future__ import annotations

import pytest
from aiohttp.test_utils import TestClient, TestServer

from apps.backend.alarm_api.service import create_app

AUTH = {"Authorization": "Bearer demo-token"}


@pytest.mark.asyncio
async def test_acceptance_path_uses_structured_alarm_data() -> None:
    async with TestClient(TestServer(create_app())) as client:
        health = await client.get("/health")
        assert health.status == 200

        search = await client.get("/assets/search?query=Boiler%20Feed%20Pump%20101&limit=10", headers=AUTH)
        assert search.status == 200
        asset_payload = await search.json()
        assert asset_payload["results"][0]["asset_id"] == "BFP-101"

        alarms = await client.get("/alarms?asset_id=BFP-101&page=1&page_size=50", headers=AUTH)
        assert alarms.status == 200
        alarm_payload = await alarms.json()
        assert alarm_payload["data"]
        assert alarm_payload["data"][0]["alarm_id"]

        summary = await client.post(
            "/alarms/summary",
            headers={**AUTH, "trace_id": "trace-test-001", "x-client-id": "pytest"},
            json={
                "asset_ids": ["BFP-101"],
                "time_range": {"start_time": "2026-05-01T00:00:00Z", "end_time": "2026-07-31T00:00:00Z"},
                "severity": ["high", "critical"],
                "group_by": ["alarm_name"],
                "kpis": ["alarm_count", "recurring_rate", "avg_ack_delay"],
            },
        )
        assert summary.status == 200
        summary_payload = await summary.json()
        assert summary_payload["total_alarms"] >= 1

        priority = await client.post("/alarms/priority-score", headers=AUTH, json={"alarm_id": "ALM-BFP101-DP-HH"})
        assert priority.status == 200
        priority_payload = await priority.json()
        assert priority_payload["priority_band"] == "urgent"

        recs = await client.post("/recommendations/operator-actions", headers=AUTH, json={"alarm_id": "ALM-BFP101-DP-HH"})
        assert recs.status == 200
        rec_payload = await recs.json()
        assert rec_payload["recommendations"]


@pytest.mark.asyncio
async def test_auth_is_required_except_health() -> None:
    async with TestClient(TestServer(create_app())) as client:
        response = await client.get("/assets/search?query=motor")
        assert response.status == 401


@pytest.mark.asyncio
async def test_postman_chaining_seed_constraints() -> None:
    async with TestClient(TestServer(create_app())) as client:
        compressors = await client.get("/assets/search?query=compressor&unit=Unit%205&limit=10", headers=AUTH)
        assert compressors.status == 200
        assert len((await compressors.json())["results"]) >= 3

        motors = await client.get("/assets/search?query=motor&unit=Unit%205&limit=10", headers=AUTH)
        assert motors.status == 200
        assert len((await motors.json())["results"]) >= 3

        east = await client.get("/alarms?site=EastRefinery&status=active", headers=AUTH)
        assert east.status == 200
        assert (await east.json())["pagination"]["total"] >= 1
