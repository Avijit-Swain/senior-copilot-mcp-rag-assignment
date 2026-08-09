from __future__ import annotations

import pytest

from apps.backend.agent.master_graph import fallback_master_decision


PREVIOUS_CONTEXT = {
    "previous_user": "Investigate recurring BFP-101 high-severity alarms and recommend cited actions.",
    "previous_assistant": (
        "Discharge Pressure High High is the top alarm for Boiler Feed Pump 101. "
        "Structured context: asset=BFP-101, assetName=Boiler Feed Pump 101, site=NorthPlant, "
        "unit=Unit 5, topAlarm=Discharge Pressure High High, priorityScore=94. "
        "Recommendations: Verify discharge valve DV-101 position. Cross-check PT-101D. "
        "Cited documents: SOP-114 §4; SOP-114 §3.1; SOP-114 §3.2."
    ),
}


@pytest.mark.parametrize(
    ("question", "context", "expected_tools"),
    [
        (
            "Which alarm has the highest priority in EastRefinery, and why?",
            {},
            ["structured"],
        ),
        (
            "When should a centrifugal pump be removed from service instead of monitored?",
            {},
            ["unstructured"],
        ),
        (
            "Why is it urgent?",
            PREVIOUS_CONTEXT,
            ["structured"],
        ),
        (
            "Show the procedure for that alarm.",
            PREVIOUS_CONTEXT,
            ["unstructured"],
        ),
        (
            "Compare that with the maintenance manual.",
            PREVIOUS_CONTEXT,
            ["unstructured"],
        ),
        (
            "Now recommend actions.",
            PREVIOUS_CONTEXT,
            ["structured"],
        ),
        (
            "Are those actions consistent with the manual?",
            PREVIOUS_CONTEXT,
            ["structured", "unstructured"],
        ),
        (
            "What safety steps apply before inspection?",
            PREVIOUS_CONTEXT,
            ["unstructured"],
        ),
        (
            "Show related assets for the same asset.",
            PREVIOUS_CONTEXT,
            ["structured"],
        ),
        (
            "What evidence supports that?",
            PREVIOUS_CONTEXT,
            ["unstructured"],
        ),
    ],
)
def test_context_aware_fallback_routes_to_expected_agents(question, context, expected_tools) -> None:
    decision = fallback_master_decision({"question": question, "conversation_context": context})

    assert decision["action"] == "dispatch"
    assert [task["tool"] for task in decision["tasks"]] == expected_tools


def test_context_objective_carries_previous_turn_for_follow_up() -> None:
    decision = fallback_master_decision({
        "question": "Show the procedure for that alarm.",
        "conversation_context": PREVIOUS_CONTEXT,
    })

    objective = decision["tasks"][0]["objective"]
    assert "Show the procedure for that alarm." in objective
    assert "Previous user question" in objective
    assert "asset=BFP-101" in objective
