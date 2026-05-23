"""Defence answers prosecution's cross-examination question (no user input)."""
from langchain_core.messages import HumanMessage, SystemMessage

from agents.clash.llm import get_clash_llm
from agents.clash.prompts import (
    DEFENCE_CROSS_RESPONSE_SCHEMA,
    PARTY_ROLES_BLOCK,
    WHO_DID_WHAT_REASONING,
    counsel_human_reminder,
)
from agents.clash.utils import (
    append_logic_entries,
    normalize_counsel_voice,
    parse_agent_response,
    register_asked_question,
)


def defence_cross_answer_node(state: dict) -> dict:
    question = state.get("pending_question") or ""
    phase = state.get("phase") or "opening"
    title = state.get("case_title") or "Matter"
    facts = state.get("case_facts") or ""
    prosecution_arg = state.get("prosecution_output") or ""
    qid = state.get("pending_question_id") or ""

    print(f"⚖️ Defence cross-answer — phase={phase}")

    system = f"""IDENTITY: You are DEFENCE COUNSEL answering on behalf of the ACCUSED/DEFENDANT.
You are NOT Prosecution. You are NOT the complainant.

{PARTY_ROLES_BLOCK}

Case: {title}
Facts on record:
{facts}

=== PROSECUTION'S ARGUMENT (opposing counsel — not your position) ===
{prosecution_arg}

=== PROSECUTION'S QUESTION TO YOUR CLIENT (the defendant) ===
"{question}"

Answer ONLY as Defence for the accused. Every reasoning_step must start with "Defence:".
Direct legal prose only — no "My Lord" or ceremonial phrases.
{WHO_DID_WHAT_REASONING}
{DEFENCE_CROSS_RESPONSE_SCHEMA}"""

    llm = get_clash_llm()
    response = llm.invoke(
        [
            SystemMessage(content=system),
            HumanMessage(
                content=(
                    f"{counsel_human_reminder('defence', phase, cross=True)}\n"
                    "Answer the Prosecution's question on behalf of the accused. JSON only; no new question."
                )
            ),
        ],
        max_tokens=400,
        temperature=0.4,
    )
    raw = response.content if isinstance(response.content, str) else str(response.content)
    parsed = parse_agent_response(raw)
    answer_text = (parsed.get("argument") or parsed.get("follow_up_question") or raw).strip()
    reasoning, answer_text = normalize_counsel_voice(
        "defence",
        parsed.get("reasoning_steps") or [],
        answer_text,
    )
    law_sections = parsed.get("law_sections") or []

    transcript = list(state.get("transcript_entries") or [])
    transcript.append(
        {
            "side": "prosecution",
            "phase": phase,
            "kind": "question",
            "content": question,
            "question_id": qid,
            "question_target": "defence",
            "law_sections": state.get("pending_law_sections") or [],
        }
    )
    for step in reasoning:
        transcript.append(
            {
                "side": "defence",
                "phase": phase,
                "kind": "reasoning",
                "content": step,
                "law_sections": law_sections,
            }
        )
    transcript.append(
        {
            "side": "defence",
            "phase": phase,
            "kind": "cross_answer",
            "content": answer_text,
            "question_id": qid,
            "law_sections": law_sections,
        }
    )

    logic_log = append_logic_entries(
        state.get("logic_log") or [],
        side="defence",
        phase=phase,
        reasoning_steps=reasoning,
        law_sections=law_sections,
        argument=f"[Cross-exam reply] {answer_text}",
    )

    user_answers = list(state.get("user_answers") or [])
    user_answers.append(
        {
            "question_id": qid,
            "question": question,
            "answer": answer_text,
            "agent_side": "prosecution",
            "phase": phase,
            "target": "defence",
        }
    )
    asked_questions = register_asked_question(
        list(state.get("asked_questions") or []), question
    )

    return {
        "transcript_entries": transcript,
        "logic_log": logic_log,
        "user_answers": user_answers,
        "asked_questions": asked_questions,
        "pending_question": None,
        "pending_question_id": None,
        "question_agent_side": None,
        "question_target": None,
        "pending_law_sections": None,
        "pending_reasoning_steps": None,
        "cross_answer_text": answer_text,
        "cross_answer_id": qid,
        "awaiting_user_input": False,
        "next_step": "defence",
    }
