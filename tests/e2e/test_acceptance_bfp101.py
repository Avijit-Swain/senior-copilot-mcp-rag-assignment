from __future__ import annotations

from apps.backend.agent import master_graph


ACCEPTANCE_QUESTION = (
    "Investigate recurring high-severity alarms for Boiler Feed Pump 101 over the last 90 days, "
    "identify likely contributing factors, retrieve the relevant operating procedure, and provide "
    "recommended actions with source evidence."
)


def test_bfp101_acceptance_scenario_combines_mcp_and_rag(monkeypatch) -> None:
    """Mandatory assignment acceptance path, kept deterministic for CI.

    The specialist agents are stubbed at the master-orchestrator boundary. This
    proves the end-to-end copilot contract without requiring live LLM or
    embedding calls in CI: the master dispatches both evidence paths, preserves
    MCP traceability, carries citations forward, and produces a grounded final
    response for the BFP-101 scenario.
    """

    def fake_structured(objective, **kwargs):
        assert "Boiler Feed Pump 101" in objective
        return {
            "tool": "structured_mcp_agent",
            "objective": objective,
            "asset_id": "BFP-101",
            "alarm_id": "ALM-BFP101-DP-HH",
            "procedure_ids": ["SOP-114"],
            "alarm_names": ["Discharge Pressure High High"],
            "assets": [{"asset_id": "BFP-101", "asset_name": "Boiler Feed Pump 101", "site": "NorthPlant", "unit": "Unit 5"}],
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
                            "alarm_name": "Discharge Pressure High High",
                            "severity": "critical",
                            "status": "active",
                            "probable_cause": "Downstream valve restriction or transmitter drift",
                            "ack_delay_seconds": 300,
                            "metadata": {"recurring_90d": True, "procedure_id": "SOP-114"},
                        }
                    ]
                },
            },
            "summary": {"ok": True, "data": {"total_alarms": 3}},
            "correlation": {
                "ok": True,
                "data": {
                    "correlations": [
                        {
                            "related_alarm_name": "Feedwater Flow Low",
                            "explanation": "Low flow events repeatedly occur within five minutes of discharge pressure spikes.",
                            "confidence": 0.82,
                        }
                    ]
                },
            },
            "priority": {"ok": True, "data": {"alarm_id": "ALM-BFP101-DP-HH", "score": 94, "priority_band": "urgent"}},
            "recommendations": {
                "ok": True,
                "data": {
                    "recommendations": [
                        {
                            "recommendation_id": "REC-BFP101-1",
                            "action_text": "Verify discharge valve DV-101 position and check for restriction before increasing pump speed.",
                            "urgency": "immediate",
                            "rank": 1,
                        },
                        {
                            "recommendation_id": "REC-BFP101-2",
                            "action_text": "Cross-check PT-101D against the local gauge and inspect impulse lines for blockage.",
                            "urgency": "immediate",
                            "rank": 2,
                        },
                    ]
                },
            },
            "mcp_trace": [
                {"name": "search_assets", "args": {"query": "Boiler Feed Pump 101"}, "result": {"ok": True}},
                {"name": "get_alarms", "args": {"asset_id": "BFP-101"}, "result": {"ok": True}},
                {"name": "get_alarm_summary", "args": {"asset_ids": ["BFP-101"]}, "result": {"ok": True}},
                {"name": "correlate_alarms", "args": {"asset_ids": ["BFP-101"]}, "result": {"ok": True}},
                {"name": "score_alarm_priority", "args": {"alarm_id": "ALM-BFP101-DP-HH"}, "result": {"ok": True}},
                {"name": "get_operator_recommendations", "args": {"alarm_id": "ALM-BFP101-DP-HH"}, "result": {"ok": True}},
            ],
        }

    def fake_unstructured(objective, **kwargs):
        assert "Boiler Feed Pump 101" in objective or "BFP" in objective
        return {
            "tool": "unstructured_rag_agent",
            "objective": objective,
            "answer": (
                "SOP-114 classifies 3-5 repeat events as recurring and requires an investigation. "
                "Operators should acknowledge the alarm, check deaerator level, verify suction strainer "
                "differential pressure, and reduce pump demand if necessary [SOP-114 §3.1][SOP-114 §3.2][SOP-114 §4]."
            ),
            "citations": [
                {"doc_id": "SOP-114", "document_title": "Boiler Feed Pump Low Suction Pressure Response", "section": "3.1", "page": 2, "quote": "Acknowledge the alarm and perform suction-side checks."},
                {"doc_id": "SOP-114", "document_title": "Boiler Feed Pump Low Suction Pressure Response", "section": "3.2", "page": 2, "quote": "Reduce pump demand if necessary."},
                {"doc_id": "SOP-114", "document_title": "Boiler Feed Pump Low Suction Pressure Response", "section": "4", "page": 3, "quote": "Recurring events shall be investigated."},
            ],
            "retrieval_rounds": 1,
            "exhausted": False,
        }

    decisions = iter([
        {
            "reason": "acceptance scenario needs alarm API evidence and cited procedure evidence",
            "action": "dispatch",
            "tasks": [
                {"tool": "structured", "objective": ACCEPTANCE_QUESTION, "reason": "resolve asset, alarms, priority, correlations and recommendations"},
                {"tool": "unstructured", "objective": ACCEPTANCE_QUESTION, "reason": "retrieve cited BFP operating procedure guidance"},
            ],
        },
        {"reason": "structured and document evidence are available", "action": "answer", "tasks": []},
    ])

    monkeypatch.setattr(master_graph, "call_master_model", lambda state: next(decisions))
    monkeypatch.setattr(master_graph, "run_structured_mcp_investigation", fake_structured)
    monkeypatch.setattr(master_graph, "run_unstructured_rag", fake_unstructured)
    monkeypatch.setattr(master_graph, "synthesize_answer", lambda state: master_graph.fallback_synthesis(state))

    state = master_graph.ask_master(ACCEPTANCE_QUESTION)

    tools = {item["tool"] for item in state["observations"]}
    assert tools == {"structured_mcp_agent", "unstructured_rag_agent"}
    assert state["dispatch_rounds"] == 1

    structured = next(item["data"] for item in state["observations"] if item["tool"] == "structured_mcp_agent")
    unstructured = next(item["data"] for item in state["observations"] if item["tool"] == "unstructured_rag_agent")

    assert structured["asset_id"] == "BFP-101"
    assert structured["alarm_id"] == "ALM-BFP101-DP-HH"
    assert structured["procedure_ids"] == ["SOP-114"]
    assert len(structured["mcp_trace"]) >= 6

    assert unstructured["citations"]
    assert {citation["doc_id"] for citation in state["citations"]} == {"SOP-114"}
    assert [call["name"] for call in state["mcp_trace"]] == [
        "search_assets",
        "get_alarms",
        "get_alarm_summary",
        "correlate_alarms",
        "score_alarm_priority",
        "get_operator_recommendations",
    ]

    answer = state["final_answer"]
    assert "Discharge Pressure High High" in answer
    assert "Verify discharge valve" in answer
    assert "SOP-114" in answer
