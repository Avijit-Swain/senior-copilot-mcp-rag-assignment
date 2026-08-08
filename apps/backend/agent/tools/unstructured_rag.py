from __future__ import annotations

from typing import Any

from apps.backend.agent import graph as rag_graph


def run_unstructured_rag(objective: str, *, parent_question: str | None = None, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run the existing document ReAct graph as a high-level unstructured tool."""
    question = objective
    if context:
        context_bits = []
        asset = context.get("asset") or context.get("asset_id")
        procedure_ids = context.get("procedure_ids") or []
        alarm_names = context.get("alarm_names") or []
        if asset:
            context_bits.append(f"asset: {asset}")
        if procedure_ids:
            context_bits.append("procedure ids: " + ", ".join(map(str, procedure_ids)))
        if alarm_names:
            context_bits.append("alarm names: " + ", ".join(map(str, alarm_names)))
        if context_bits:
            question = f"{objective}\n\nKnown structured context: " + "; ".join(context_bits)
    state = rag_graph.ask(question)
    return {
        "tool": "unstructured_rag_agent",
        "objective": objective,
        "parent_question": parent_question,
        "answer": state.get("answer", ""),
        "citations": state.get("citations", []),
        "subqueries": state.get("executed", []),
        "sub_answers": state.get("sub_answers", []),
        "retrieval_rounds": state.get("retrieval_rounds", 0),
        "exhausted": state.get("exhausted", False),
    }
