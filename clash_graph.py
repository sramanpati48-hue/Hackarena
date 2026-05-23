"""LangGraph workflow for Clash Mode courtroom debate."""
from typing import Any, Dict, List, Literal, Optional, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from agents.clash import (
    defence_cross_answer_node,
    defence_turn_node,
    final_judge_node,
    incorporate_user_answer_node,
    judge_round_node,
    preprocess_case_node,
    prosecution_turn_node,
)

CLASH_STREAM_NODES = {"prosecution", "defence"}


class ClashState(TypedDict, total=False):
    mode: str
    case_title: str
    case_facts: str
    mock_case_id: Optional[str]
    session_id: str
    user_id: Optional[str]
    phase: str
    phase_index: int
    round_number: int
    messages: List[Any]
    prosecution_output: str
    defence_output: str
    judge_notes: str
    round_scores: List[Dict[str, Any]]
    final_result: Dict[str, Any]
    final_score: float
    verdict: str
    transcript_entries: List[Dict[str, Any]]
    logic_log: List[Dict[str, Any]]
    pending_question: Optional[str]
    pending_question_id: Optional[str]
    question_agent_side: Optional[str]
    question_target: Optional[str]
    awaiting_user_input: bool
    resumed_answer: Optional[str]
    resume_node: Optional[str]
    user_answers: List[Dict[str, Any]]
    asked_questions: List[str]
    next_step: str


def _route_after_prosecution(state: ClashState) -> str:
    nxt = state.get("next_step")
    if nxt == "defence_cross_answer":
        return "defence_cross_answer"
    if state.get("awaiting_user_input"):
        return END
    return "defence"


def _route_after_defence_cross(state: ClashState) -> str:
    return "defence"


def _route_after_defence(state: ClashState) -> str:
    if state.get("awaiting_user_input"):
        return END
    return "judge_round"


def _route_after_judge(state: ClashState) -> str:
    nxt = state.get("next_step", "end")
    if nxt == "prosecution":
        return "prosecution"
    if nxt == "final_judge":
        return "final_judge"
    return END


def _route_entry(state: ClashState) -> str:
    if state.get("resumed_answer"):
        return "incorporate_answer"
    nxt = state.get("next_step")
    if nxt == "prosecution":
        return "prosecution"
    if nxt == "defence":
        return "defence"
    if nxt == "judge_round":
        return "judge_round"
    if nxt == "final_judge":
        return "final_judge"
    if nxt == "wait_user":
        return END
    return "preprocess"


def _route_after_incorporate(state: ClashState) -> str:
    nxt = state.get("next_step", "prosecution")
    if nxt == "defence":
        return "defence"
    if nxt == "judge_round":
        return "judge_round"
    if nxt == "prosecution":
        return "prosecution"
    return "prosecution"


workflow = StateGraph(ClashState)

workflow.add_node("preprocess", preprocess_case_node)
workflow.add_node("prosecution", prosecution_turn_node)
workflow.add_node("defence", defence_turn_node)
workflow.add_node("defence_cross_answer", defence_cross_answer_node)
workflow.add_node("judge_round", judge_round_node)
workflow.add_node("final_judge", final_judge_node)
workflow.add_node("incorporate_answer", incorporate_user_answer_node)

workflow.set_conditional_entry_point(
    _route_entry,
    {
        "preprocess": "preprocess",
        "prosecution": "prosecution",
        "defence": "defence",
        "judge_round": "judge_round",
        "final_judge": "final_judge",
        "incorporate_answer": "incorporate_answer",
        END: END,
    },
)

workflow.add_edge("preprocess", "prosecution")
workflow.add_conditional_edges(
    "prosecution",
    _route_after_prosecution,
    {"defence": "defence", "defence_cross_answer": "defence_cross_answer", END: END},
)
workflow.add_edge("defence_cross_answer", "defence")
workflow.add_conditional_edges(
    "defence",
    _route_after_defence,
    {"judge_round": "judge_round", END: END},
)
workflow.add_conditional_edges(
    "judge_round",
    _route_after_judge,
    {"prosecution": "prosecution", "final_judge": "final_judge", END: END},
)
workflow.add_conditional_edges(
    "incorporate_answer",
    _route_after_incorporate,
    {
        "prosecution": "prosecution",
        "defence": "defence",
        "judge_round": "judge_round",
    },
)
workflow.add_edge("final_judge", END)

checkpointer = MemorySaver()
clash_graph = workflow.compile(checkpointer=checkpointer)
