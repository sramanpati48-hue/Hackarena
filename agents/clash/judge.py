"""Judge evaluation — per-parameter prosecution vs defence scoring."""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from agents.clash.constants import JUDGE_PARAMETERS
from agents.clash.llm import get_clash_llm
from agents.clash.preprocess import PHASES
from agents.clash.prompts import judge_final_prompt, judge_round_prompt
from agents.clash.utils import (
    aggregate_final_scores,
    build_parameter_round_score,
    logic_log_for_phase,
    parse_json_from_text,
    safe_float,
)
from clash_schemas import ClashPhase


def _statements_digest(state: dict, phase: str) -> str:
    lines = []
    for e in state.get("transcript_entries") or []:
        if not isinstance(e, dict):
            continue
        if e.get("phase") != phase and e.get("kind") not in ("argument", "reasoning"):
            continue
        side = e.get("side", "?")
        kind = e.get("kind", "argument")
        text = (e.get("content") or "")[:200]
        if text:
            lines.append(f"- [{kind}] {side}: {text}")
    return "\n".join(lines[-12:]) or "No prior statements."


def judge_round_node(state: dict) -> dict:
    phase = state.get("phase") or "opening"
    p_arg = state.get("prosecution_output") or ""
    d_arg = state.get("defence_output") or ""
    title = state.get("case_title") or "Matter"

    llm = get_clash_llm()
    digest = _statements_digest(state, phase)
    logic_log = state.get("logic_log") or []
    phase_logic = logic_log_for_phase(logic_log, phase)
    logic_json = json.dumps(phase_logic[-24:], indent=2, ensure_ascii=False)

    system = judge_round_prompt(phase, title, p_arg, d_arg, digest, logic_json)
    try:
        response = llm.invoke(
            [
                SystemMessage(content=system),
                HumanMessage(
                    content="Score this phase. Scores must differ between sides — no blanket ties."
                ),
            ],
            max_tokens=1200,
            temperature=0.15,
        )
        content = response.content if isinstance(response.content, str) else str(response.content)
        parsed = parse_json_from_text(content)
    except Exception as e:
        print(f"⚠️ Judge round LLM failed, using comparative heuristics: {e}")
        parsed = None

    score = build_parameter_round_score(phase, p_arg, d_arg, parsed, logic_log=logic_log)
    score["logic_reviewed"] = (parsed or {}).get("logic_reviewed") or [
        e.get("content", "")[:80] for e in phase_logic[-4:]
    ]

    rounds = list(state.get("round_scores") or [])
    rounds.append(score)

    phase_index = int(state.get("phase_index") or 0)
    next_index = phase_index + 1

    if next_index < len(PHASES):
        next_phase = PHASES[next_index]
        return {
            "round_scores": rounds,
            "phase_index": next_index,
            "phase": next_phase.value,
            "round_number": int(state.get("round_number") or 1) + 1,
            "prosecution_output": "",
            "defence_output": "",
            "judge_notes": score.get("bench_note", ""),
            "user_answers": state.get("user_answers") or [],
            "asked_questions": state.get("asked_questions") or [],
            "next_step": "prosecution",
        }

    return {
        "round_scores": rounds,
        "judge_notes": score.get("bench_note", ""),
        "user_answers": state.get("user_answers") or [],
        "asked_questions": state.get("asked_questions") or [],
        "next_step": "final_judge",
    }


def final_judge_node(state: dict) -> dict:
    llm = get_clash_llm()
    mode = state.get("mode") or "practice"
    title = state.get("case_title") or "Matter"
    facts = state.get("case_facts") or ""
    rounds = state.get("round_scores") or []

    aggregate = aggregate_final_scores(rounds)

    summary_lines = []
    for r in rounds:
        if not isinstance(r, dict):
            continue
        summary_lines.append(
            f"Phase {r.get('phase')}: P avg {r.get('prosecution_average')} vs "
            f"D avg {r.get('defence_average')} — winner {r.get('round_winner')} — "
            f"{r.get('bench_note', '')}"
        )

    logic_log = state.get("logic_log") or []
    logic_json = json.dumps(logic_log[-40:], indent=2, ensure_ascii=False)

    system = judge_final_prompt(
        mode, title, facts, "\n".join(summary_lines), aggregate, logic_json
    )
    system += "\n\nThe declared_winner MUST align with the higher overall parameter average unless a draw is justified."

    try:
        response = llm.invoke(
            [
                SystemMessage(content=system),
                HumanMessage(content="Deliver final judgment with full winner record."),
            ],
            max_tokens=1200,
            temperature=0.15,
        )
        content = response.content if isinstance(response.content, str) else str(response.content)
        parsed = parse_json_from_text(content) or {}
    except Exception as e:
        print(f"⚠️ Final judge LLM failed: {e}")
        parsed = {}

    declared = str(parsed.get("declared_winner") or aggregate["declared_winner"]).lower()
    if declared not in ("prosecution", "defence", "draw"):
        declared = aggregate["declared_winner"]

    winner_explanation = str(
        parsed.get("winner_explanation") or parsed.get("winner_rationale") or ""
    ).strip()
    if not winner_explanation:
        p_avg = aggregate["prosecution_overall_average"]
        d_avg = aggregate["defence_overall_average"]
        winner_explanation = (
            f"After independent scoring on {len(JUDGE_PARAMETERS)} parameters across all phases, "
            f"Prosecution averaged {p_avg}/20 and Defence averaged {d_avg}/20. "
            f"The Court declares {declared.replace('_', ' ')} as prevailing."
        )

    mock_verdict = str(
        parsed.get("mock_verdict") or "Simulation complete — review parameter scores in the record."
    )

    final = {
        "overall_score": safe_float(
            parsed.get("overall_score"),
            max(aggregate["prosecution_overall_average"], aggregate["defence_overall_average"]) * 5,
        ),
        "confidence_band": str(parsed.get("confidence_band") or "medium"),
        "mock_verdict": mock_verdict,
        "declared_winner": declared,
        "winner_explanation": winner_explanation,
        "actionability_notes": str(parsed.get("actionability_notes") or ""),
        "evidence_gaps": parsed.get("evidence_gaps") or [],
        "unresolved_questions": parsed.get("unresolved_questions") or [],
        "round_scores": rounds,
        "judge_parameters": state.get("judge_parameters") or JUDGE_PARAMETERS,
        "parameter_totals": aggregate["parameter_totals"],
        "prosecution_overall_average": aggregate["prosecution_overall_average"],
        "defence_overall_average": aggregate["defence_overall_average"],
        "logic_log": logic_log,
    }

    transcript = list(state.get("transcript_entries") or [])
    transcript.append(
        {
            "side": "judge",
            "phase": ClashPhase.closing.value,
            "kind": "verdict",
            "content": winner_explanation,
            "mock_verdict": mock_verdict,
            "declared_winner": declared,
        }
    )

    return {
        "final_result": final,
        "final_score": final["overall_score"],
        "verdict": final["mock_verdict"],
        "transcript_entries": transcript,
        "next_step": "end",
        "phase": ClashPhase.closing.value,
    }
