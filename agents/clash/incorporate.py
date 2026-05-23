"""Merge user answer and clear pause flags."""
from agents.clash.utils import register_asked_question


def incorporate_user_answer_node(state: dict) -> dict:
    answer = (state.get("resumed_answer") or "").strip()
    question = state.get("pending_question") or ""
    qid = state.get("pending_question_id") or ""
    side = state.get("question_agent_side") or "prosecution"

    user_answers = list(state.get("user_answers") or [])
    user_answers.append({
        "question_id": qid,
        "question": question,
        "answer": answer,
        "agent_side": side,
        "phase": state.get("phase"),
    })
    asked_questions = register_asked_question(
        list(state.get("asked_questions") or []), question
    )

    transcript = list(state.get("transcript_entries") or [])
    transcript.append({
        "side": "user",
        "phase": state.get("phase"),
        "content": answer,
        "kind": "user_answer",
        "question_id": qid,
        "asked_by": side,
    })

    resume = state.get("resume_node") or side
    return {
        "user_answers": user_answers,
        "asked_questions": asked_questions,
        "transcript_entries": transcript,
        "resumed_answer": None,
        "awaiting_user_input": False,
        "pending_question": None,
        "pending_question_id": None,
        "next_step": resume,
    }
