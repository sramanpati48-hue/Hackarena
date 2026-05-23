"""Case preprocessing for Clash Mode."""
from agents.clash.constants import JUDGE_PARAMETERS
from clash_schemas import ClashPhase

# Three fast rounds — full courtroom arc without 5 slow LLM cycles
PHASES = [
    ClashPhase.opening,
    ClashPhase.rebuttal,
    ClashPhase.closing,
]


def preprocess_case_node(state: dict) -> dict:
    title = state.get("case_title") or "Untitled Matter"
    facts = state.get("case_facts") or ""
    mode = state.get("mode") or "practice"

    enriched = facts.strip()
    if mode == "real_life":
        enriched = (
            f"[Real-life simulation — not legal advice]\n{enriched}\n\n"
            "The Court will evaluate arguments based solely on facts provided."
        )

    return {
        "case_facts": enriched,
        "case_title": title,
        "phase": ClashPhase.opening.value,
        "phase_index": 0,
        "round_number": 1,
        "round_scores": state.get("round_scores") or [],
        "transcript_entries": state.get("transcript_entries") or [],
        "logic_log": state.get("logic_log") or [],
        "user_answers": state.get("user_answers") or [],
        "asked_questions": state.get("asked_questions") or [],
        "judge_parameters": JUDGE_PARAMETERS,
        "awaiting_user_input": False,
        "pending_question": None,
        "question_agent_side": None,
        "resume_node": None,
        "next_step": "prosecution",
    }
