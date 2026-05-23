"""Defence agent turn."""
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from agents.clash.llm import get_clash_llm
from agents.clash.prompts import counsel_human_reminder, defence_system_prompt
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
    entries = state.get("transcript_entries") or []
    lines = []
    for e in entries[-8:]:
        if isinstance(e, dict):
            side = e.get("side", "?")
            kind = e.get("kind", "argument")
            lines.append(
                f"- {side} [{kind}] ({e.get('phase')}): {(e.get('content') or '')[:100]}..."
            )
    return "\n".join(lines) or "None."


def defence_turn_node(state: dict) -> dict:
    phase = state.get("phase") or "opening"
    print(f"⚖️ Clash defence turn — phase={phase}")
    llm = get_clash_llm()
    title = state.get("case_title") or "Matter"
    facts = state.get("case_facts") or ""
    prosecution_arg = state.get("prosecution_output") or ""

    asked = list(state.get("asked_questions") or [])
    convo = build_clash_conversation_context(state)
    asked_block = format_asked_questions_block(asked)

    system = defence_system_prompt(
        phase,
        title,
        facts,
        _prior_summary(state),
        prosecution_arg,
        convo,
        asked_block,
    )
    messages = [
        SystemMessage(content=system),
        HumanMessage(
            content=(
                f"{counsel_human_reminder('defence', phase)}\n"
                "Present your submission as JSON. reasoning_steps = Defence only; "
                "follow_up_question only if NEW and specific to the transcript; else null. "
                "Target: COMPLAINANT (user) only."
            )
        ),
    ]

    response = llm.invoke(messages, max_tokens=550, temperature=0.45)
    raw = response.content if isinstance(response.content, str) else str(response.content)
    parsed = parse_agent_response(raw)
    argument = parsed.get("argument") or raw
    reasoning, argument = normalize_counsel_voice(
        "defence",
        parsed.get("reasoning_steps") or [],
        argument,
    )
    law_sections = parsed.get("law_sections") or []

    transcript = list(state.get("transcript_entries") or [])
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
    if argument.strip():
        transcript.append(
            {
                "side": "defence",
                "phase": phase,
                "kind": "argument",
                "content": argument,
                "law_sections": law_sections,
            }
        )

    follow_up = extract_follow_up_question(
        parsed,
        side="defence",
        phase=phase,
        argument=argument,
        case_facts=facts,
        opposition_arg=prosecution_arg,
        asked_questions=asked,
    )

    logic_log = append_logic_entries(
        state.get("logic_log") or [],
        side="defence",
        phase=phase,
        reasoning_steps=reasoning,
        law_sections=law_sections,
        argument=argument,
    )

    user_answers = list(state.get("user_answers") or [])
    base = {
        "messages": [AIMessage(content=argument)],
        "defence_output": argument,
        "defence_reasoning": reasoning,
        "defence_law_sections": law_sections,
        "transcript_entries": transcript,
        "logic_log": logic_log,
        "user_answers": user_answers,
        "asked_questions": asked,
    }

    if follow_up:
        qid = new_question_id()
        asked = register_asked_question(asked, follow_up)
        resume_after = "judge_round" if argument.strip() else "defence"
        return {
            **base,
            "asked_questions": asked,
            "awaiting_user_input": True,
            "pending_question": follow_up,
            "pending_question_id": qid,
            "question_agent_side": "defence",
            "question_target": "user",
            "resume_node": resume_after,
            "pending_law_sections": law_sections,
            "pending_reasoning_steps": reasoning,
            "next_step": "wait_user",
        }

    return {
        **base,
        "awaiting_user_input": False,
        "pending_question": None,
        "resume_node": None,
        "next_step": "judge_round",
    }
