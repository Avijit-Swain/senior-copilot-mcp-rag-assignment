from __future__ import annotations

import pytest
from aiohttp.test_utils import TestClient, TestServer

from apps.backend import server


@pytest.mark.asyncio
async def test_chat_returns_ui_answer_block(monkeypatch) -> None:
    monkeypatch.setattr(
        server,
        "ask_master",
        lambda question, conversation_context=None: {
            "final_answer": "Investigate BFP 101.\nCheck the discharge valve and pressure transmitter.",
            "citations": [
                {
                    "doc_id": "BFP-OP-102",
                    "section": "3.1",
                    "document_title": "BFP Operating Procedure",
                    "kind": "operating-procedure",
                    "page": 2,
                    "quote": "Verify discharge valve position.",
                }
            ],
            "observations": [
                {
                    "tool": "structured_mcp_agent",
                    "data": {
                        "asset_id": "BFP-101",
                        "alarm_id": "ALM-BFP101-DP-HH",
                        "procedure_ids": ["BFP-OP-102"],
                        "mcp_trace": [
                            {
                                "name": "search_assets",
                                "args": {"query": "Boiler Feed Pump 101"},
                                "result": {
                                    "ok": True,
                                    "data": {"results": [{"asset_id": "BFP-101"}]},
                                    "trace": {"status_code": 200, "duration_ms": 12, "attempts": 1},
                                },
                            }
                        ],
                        "alarms": {
                            "ok": True,
                            "data": {
                                "data": [
                                    {
                                        "alarm_id": "ALM-BFP101-DP-HH",
                                        "asset_id": "BFP-101",
                                        "asset_name": "Boiler Feed Pump 101",
                                        "site": "NorthPlant",
                                        "unit": "Unit 5",
                                        "severity": "critical",
                                        "status": "active",
                                        "alarm_name": "Discharge Pressure High High",
                                        "ack_delay_seconds": 300,
                                        "metadata": {"recurring_90d": True},
                                    }
                                ]
                            },
                        },
                        "priority": {"ok": True, "data": {"score": 94, "priority_band": "urgent"}},
                        "correlation": {"ok": True, "data": {"correlations": []}},
                        "recommendations": {
                            "ok": True,
                            "data": {
                                "recommendations": [
                                    {
                                        "recommendation_id": "REC-1",
                                        "action_text": "Verify discharge valve DV-101 position.",
                                    }
                                ]
                            },
                        },
                    },
                },
                {
                    "tool": "unstructured_rag_agent",
                    "data": {"answer": "Use BFP-OP-102 [BFP-OP-102 §3.1]", "citations": [], "exhausted": False},
                },
            ],
            "mcp_trace": [
                {
                    "name": "search_assets",
                    "args": {"query": "Boiler Feed Pump 101"},
                    "result": {
                        "ok": True,
                        "data": {"results": [{"asset_id": "BFP-101"}]},
                        "trace": {"status_code": 200, "duration_ms": 12, "attempts": 1},
                    },
                }
            ],
        },
    )

    async with TestClient(TestServer(server.create_app())) as client:
        response = await client.post("/api/chat", json={"question": "Investigate BFP 101"})
        assert response.status == 200
        payload = await response.json()

    answer = payload["answer"]
    assert answer["summary"]["assetId"] == "BFP-101"
    assert answer["summary"]["priorityScore"] == 94
    assert answer["toolCalls"][0]["toolName"] == "search_assets"
    assert answer["citations"][0]["documentId"] == "BFP-OP-102"
    assert answer["recommendations"][0]["agreement"] == "api-only"
    assert answer["recommendations"][0]["citationRefs"] == []


@pytest.mark.asyncio
async def test_chat_requires_question() -> None:
    async with TestClient(TestServer(server.create_app())) as client:
        response = await client.post("/api/chat", json={})
        assert response.status == 400
        payload = await response.json()
        assert payload["error"]["code"] == "missing_question"


@pytest.mark.asyncio
async def test_chat_passes_previous_turn_context_to_master(monkeypatch) -> None:
    captured = {}

    def fake_ask_master(question, conversation_context=None):
        captured["question"] = question
        captured["conversation_context"] = conversation_context
        return {
            "final_answer": "Context-aware answer.",
            "citations": [],
            "observations": [],
            "mcp_trace": [],
        }

    monkeypatch.setattr(server, "ask_master", fake_ask_master)

    async with TestClient(TestServer(server.create_app())) as client:
        response = await client.post(
            "/api/chat",
            json={
                "question": "Why is it urgent?",
                "conversationContext": {
                    "previousUser": "Investigate BFP-101 alarms.",
                    "previousAssistant": "BFP-101 has an urgent Discharge Pressure High High alarm.",
                },
            },
        )

    assert response.status == 200
    assert captured["question"] == "Why is it urgent?"
    assert captured["conversation_context"] == {
        "previous_user": "Investigate BFP-101 alarms.",
        "previous_assistant": "BFP-101 has an urgent Discharge Pressure High High alarm.",
    }
