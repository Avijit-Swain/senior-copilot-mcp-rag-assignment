from __future__ import annotations

from apps.backend.agent import master_graph


def test_master_dispatches_structured_and_unstructured_in_parallel(monkeypatch) -> None:
    decisions = iter([
        {
            "reason": "need API alarms and document guidance independently",
            "action": "dispatch",
            "tasks": [
                {"tool": "structured", "objective": "Investigate Boiler Feed Pump 101 alarms", "reason": "structured alarm data"},
                {"tool": "unstructured", "objective": "Find BFP 101 operating guidance", "reason": "document citations"},
            ],
        },
        {"reason": "both tool results are available", "action": "answer", "tasks": []},
    ])

    monkeypatch.setattr(master_graph, "call_master_model", lambda state: next(decisions))
    monkeypatch.setattr(master_graph, "synthesize_answer", lambda state: "combined final answer")
    monkeypatch.setattr(
        master_graph,
        "run_structured_mcp_investigation",
        lambda objective, **kwargs: {
            "tool": "structured_mcp_agent",
            "objective": objective,
            "asset_id": "BFP-101",
            "alarm_id": "ALM-BFP101-DP-HH",
            "procedure_ids": ["BFP-OP-102"],
            "alarm_names": ["Discharge Pressure High High"],
            "mcp_trace": [{"name": "search_assets"}, {"name": "get_alarms"}],
        },
    )
    monkeypatch.setattr(
        master_graph,
        "run_unstructured_rag",
        lambda objective, **kwargs: {
            "tool": "unstructured_rag_agent",
            "objective": objective,
            "answer": "Follow BFP-OP-102 [BFP-OP-102 §3.1]",
            "citations": [{"doc_id": "BFP-OP-102", "section": "3.1"}],
            "retrieval_rounds": 1,
        },
    )

    state = master_graph.GRAPH.invoke({"question": "Investigate BFP 101 and cite the procedure"})

    assert state["final_answer"] == "combined final answer"
    assert len(state["observations"]) == 2
    assert {item["tool"] for item in state["observations"]} == {"structured_mcp_agent", "unstructured_rag_agent"}
    assert [call["name"] for call in state["mcp_trace"]] == ["search_assets", "get_alarms"]
    assert state["citations"] == [{"doc_id": "BFP-OP-102", "section": "3.1"}]
    assert state["dispatch_rounds"] == 1


def test_master_can_sequence_rag_after_structured_context(monkeypatch) -> None:
    captured_contexts = []

    def decide(state):
        if state.get("round", 0) == 0:
            return {
                "reason": "need structured context first",
                "action": "dispatch",
                "tasks": [{"tool": "structured", "objective": "Find the alarm and procedure id for BFP 101", "reason": "dependency"}],
            }
        if state.get("round", 0) == 1:
            assert any(item["tool"] == "structured_mcp_agent" for item in state.get("observations", []))
            return {
                "reason": "use discovered procedure id for document retrieval",
                "action": "dispatch",
                "tasks": [{"tool": "unstructured", "objective": "Retrieve the operating procedure for BFP-OP-102", "reason": "depends on structured output"}],
            }
        return {"reason": "ready", "action": "answer", "tasks": []}

    def fake_unstructured(objective, **kwargs):
        captured_contexts.append(kwargs.get("context") or {})
        return {
            "tool": "unstructured_rag_agent",
            "objective": objective,
            "answer": "Procedure retrieved [BFP-OP-102 §4.2]",
            "citations": [{"doc_id": "BFP-OP-102", "section": "4.2"}],
            "retrieval_rounds": 1,
        }

    monkeypatch.setattr(master_graph, "call_master_model", decide)
    monkeypatch.setattr(master_graph, "synthesize_answer", lambda state: "sequential final answer")
    monkeypatch.setattr(
        master_graph,
        "run_structured_mcp_investigation",
        lambda objective, **kwargs: {
            "tool": "structured_mcp_agent",
            "objective": objective,
            "asset_id": "BFP-101",
            "alarm_id": "ALM-BFP101-DP-HH",
            "procedure_ids": ["BFP-OP-102"],
            "alarm_names": ["Discharge Pressure High High"],
            "mcp_trace": [{"name": "search_assets"}, {"name": "get_alarm_summary"}],
        },
    )
    monkeypatch.setattr(master_graph, "run_unstructured_rag", fake_unstructured)

    state = master_graph.GRAPH.invoke({"question": "Which procedure applies to the BFP 101 alarm?"})

    assert state["final_answer"] == "sequential final answer"
    assert state["dispatch_rounds"] == 2
    assert [item["tool"] for item in sorted(state["observations"], key=lambda x: x["index"])] == ["structured_mcp_agent", "unstructured_rag_agent"]
    assert captured_contexts[0]["asset_id"] == "BFP-101"
    assert captured_contexts[0]["procedure_ids"] == ["BFP-OP-102"]



def test_fallback_plans_structured_only_for_priority_question() -> None:
    decision = master_graph.fallback_master_decision({"question": "Which alarm has the highest priority in EastRefinery and why?"})

    assert decision["action"] == "dispatch"
    assert [task["tool"] for task in decision["tasks"]] == ["structured"]


def test_fallback_plans_parallel_for_consistency_question() -> None:
    decision = master_graph.fallback_master_decision({"question": "Are the API recommendations for Boiler Feed Pump 101 consistent with the maintenance manual?"})

    assert decision["action"] == "dispatch"
    assert [task["tool"] for task in decision["tasks"]] == ["structured", "unstructured"]
