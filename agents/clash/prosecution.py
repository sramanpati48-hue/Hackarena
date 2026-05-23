"""Prosecution / complainant agent turn."""
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from agents.clash.llm import get_clash_llm
from agents.clash.prompts import counsel_human_reminder, prosecution_system_prompt
from agents.clash.utils import (
    append_logic_entries,
    build_clash_conversation_context,
    extract_follow_up_question,
    format_asked_questions_block,
    new_question_id,
    normalize_counsel_voice,
    parse_agent_response,
    register_asked_question,
)


def _prior_summary(state: dict) -> str:
    rounds = state.get("round_scores") or []
    lines = []
    for r in rounds[-3:]:
        if isinstance(r, dict):
            lines.append(
                f"- {r.get('phase', '?')}: P {r.get('prosecution_average', 'N/A')} vs "
                f"D {r.get('defence_average', 'N/A')} (winner: {r.get('round_winner')})"
            )
    entries = state.get("transcript_entries") or []
    for e in entries[-4:]:
        if isinstance(e, dict) and e.get("side") == "prosecution" and e.get("kind") == "argument":
            lines.append(
                f"- Prosecution ({e.get('phase')}): {(e.get('content') or '')[:120]}..."
            )
    return "\n".join(lines) or "None."


def prosecution_turn_node(state: dict) -> dict:
    phase = state.get("phase") or "opening"
    print(f"⚖️ Clash prosecution turn — phase={phase}")
    llm = get_clash_llm()
    title = state.get("case_title") or "Matter"
    facts = state.get("case_facts") or ""

    asked = list(state.get("asked_questions") or [])
    convo = build_clash_conversation_context(state)
    asked_block = format_asked_questions_block(asked)

    system = prosecution_system_prompt(
        phase, title, facts, _prior_summary(state), convo, asked_block
    )
    messages = [SystemMessage(content=system)]
    for m in state.get("messages") or []:
        messages.append(m)
    if not any(isinstance(m, HumanMessage) for m in messages[1:]):
        messages.append(
            HumanMessage(
                content=(
                    f"{counsel_human_reminder('prosecution', phase)}\n"
                    "Present your submission as JSON. reasoning_steps = Prosecution only; "
                    "follow_up_question only if NEW and specific to the transcript; else null. "
                    "Target: DEFENDANT/ACCUSED only."
                )
            )
        )

    response = llm.invoke(messages, max_tokens=550, temperature=0.45)
    raw = response.content if isinstance(response.content, str) else str(response.content)
    parsed = parse_agent_response(raw)
    argument = parsed.get("argument") or raw
    reasoning, argument = normalize_counsel_voice(
        "prosecution",
        parsed.get("reasoning_steps") or [],
        argument,
    )
    law_sections = parsed.get("law_sections") or []

    transcript = list(state.get("transcript_entries") or [])
    for step in reasoning:
        transcript.append(
            {
                "side": "prosecution",
                "phase": phase,
                "kind": "reasoning",
                "content": step,
                "law_sections": law_sections,
            }
        )
    if argument.strip():
        transcript.append(
            {
                "side": "prosecution",
                "phase": phase,
                "kind": "argument",
                "content": argument,
                "law_sections": law_sections,
            }
        )

    follow_up = extract_follow_up_question(
        parsed,
        side="prosecution",
        phase=phase,
        argument=argument,
        case_facts=facts,
        asked_questions=asked,
    )

    logic_log = append_logic_entries(
        state.get("logic_log") or [],
        side="prosecution",
        phase=phase,
        reasoning_steps=reasoning,
        law_sections=law_sections,
        argument=argument,
    )

    user_answers = list(state.get("user_answers") or [])
    base = {
        "messages": [AIMessage(content=argument)],
        "prosecution_output": argument,
        "prosecution_reasoning": reasoning,
        "prosecution_law_sections": law_sections,
        "transcript_entries": transcript,
        "logic_log": logic_log,
        "user_answers": user_answers,
        "asked_questions": asked,
    }

    if follow_up:
        qid = new_question_id()
        asked = register_asked_question(asked, follow_up)
        return {
            **base,
            "asked_questions": asked,
            "awaiting_user_input": False,
            "pending_question": follow_up,
            "pending_question_id": qid,
            "question_agent_side": "prosecution",
            "question_target": "defence",
            "pending_law_sections": law_sections,
            "pending_reasoning_steps": reasoning,
            "next_step": "defence_cross_answer",
        }

    return {
        **base,
        "awaiting_user_input": False,
        "pending_question": None,
        "resume_node": None,
        "next_step": "defence",
    }
