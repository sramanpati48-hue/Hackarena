"""Shared helpers for Clash agents."""
import json
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from agents.clash.constants import JUDGE_PARAMETERS


def parse_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _as_str_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [s.strip() for s in value.split("\n") if s.strip()]
    if isinstance(value, list):
        out: List[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
            elif isinstance(item, dict):
                text = item.get("step") or item.get("text") or item.get("reasoning")
                if text:
                    out.append(str(text).strip())
        return out
    return []


_COURTESY_PREFIXES = (
    r"^my lord,?\s*",
    r"^your honour,?\s*",
    r"^your honor,?\s*",
    r"^honou?rable court,?\s*",
    r"^this court,?\s*",
    r"^prosecution submits that\s*",
    r"^defence submits that\s*",
    r"^defense submits that\s*",
)


def strip_courtroom_courtesy(text: str) -> str:
    """Remove ceremonial courtroom phrasing from counsel output."""
    t = (text or "").strip()
    if not t:
        return t
    for _ in range(4):
        before = t
        for pat in _COURTESY_PREFIXES:
            t = re.sub(pat, "", t, flags=re.IGNORECASE).strip()
        if t == before:
            break
    return t


def normalize_question_key(question: str) -> str:
    q = (question or "").lower().strip()
    for prefix in (
        "to the defendant/accused:",
        "to the defendant:",
        "to the accused:",
        "to the complainant:",
        "to the user:",
    ):
        if q.startswith(prefix):
            q = q[len(prefix) :].strip()
    return re.sub(r"\s+", " ", q)[:240]


def is_duplicate_question(question: str, asked_questions: List[str]) -> bool:
    key = normalize_question_key(question)
    if not key or len(key) < 8:
        return False
    for existing in asked_questions:
        ex = normalize_question_key(existing)
        if not ex:
            continue
        if key == ex:
            return True
        if len(key) > 24 and len(ex) > 24 and (key in ex or ex in key):
            return True
    return False


def register_asked_question(asked: List[str], question: str) -> List[str]:
    q = (question or "").strip()
    if not q or is_duplicate_question(q, asked):
        return list(asked)
    return list(asked) + [q]


def build_clash_conversation_context(state: dict) -> str:
    """Full debate + Q&A for counsel to read before asking anything new."""
    lines: List[str] = []

    user_answers = state.get("user_answers") or []
    if user_answers:
        lines.append("=== COMPLAINANT / USER ANSWERS (on record) ===")
        for i, a in enumerate(user_answers, 1):
            if not isinstance(a, dict):
                continue
            lines.append(
                f"{i}. Q ({a.get('agent_side', '?')}, {a.get('phase', '?')}): "
                f"{a.get('question', '')}\n   A: {a.get('answer', '')}"
            )

    entries = state.get("transcript_entries") or []
    if entries:
        lines.append("\n=== DEBATE TRANSCRIPT ===")
        for e in entries[-24:]:
            if not isinstance(e, dict):
                continue
            content = (e.get("content") or "").strip()
            if not content:
                continue
            side = e.get("side", "?")
            kind = e.get("kind", "text")
            phase = e.get("phase", "")
            lines.append(f"[{side}/{kind}/{phase}] {content[:280]}")

    p_out = state.get("prosecution_output") or ""
    d_out = state.get("defence_output") or ""
    if p_out:
        lines.append(f"\n[Latest prosecution argument] {p_out[:400]}")
    if d_out:
        lines.append(f"\n[Latest defence argument] {d_out[:400]}")

    return "\n".join(lines) or "No prior exchanges yet."


def format_asked_questions_block(asked: List[str]) -> str:
    if not asked:
        return "None yet."
    return "\n".join(f"- {q}" for q in asked)


def normalize_counsel_voice(
    side: str,
    reasoning_steps: List[str],
    argument: str,
) -> tuple[List[str], str]:
    """Ensure reasoning and argument stay in the correct counsel's voice."""
    label = "Prosecution" if side == "prosecution" else "Defence"
    other = "Defence" if side == "prosecution" else "Prosecution"

    defence_phrases = (
        "we contest",
        "our client",
        "my client",
        "the accused denies",
        "defence submits",
        "warranty excludes",
    )
    prosecution_phrases = (
        "the complainant must prevail",
        "prosecution submits that the complainant",
        "the accused is liable",
    )

    normed_steps: List[str] = []
    for step in reasoning_steps:
        s = str(step).strip()
        if not s:
            continue
        low = s.lower()
        if low.startswith(f"{other.lower()}:"):
            s = f"{label}: " + s.split(":", 1)[-1].strip()
            low = s.lower()
        elif not low.startswith(f"{label.lower()}:"):
            s = f"{label}: {s}"
            low = s.lower()
        body = s.split(":", 1)[-1].strip() if ":" in s else s
        body_low = body.lower()
        if side == "prosecution" and any(body_low.startswith(p) for p in defence_phrases):
            body = f"the complainant's case is that {body}"
        elif side == "defence" and any(body_low.startswith(p) for p in prosecution_phrases):
            body = f"the accused disputes that {body}"
        normed_steps.append(f"{label}: {strip_courtroom_courtesy(body)}")

    arg = strip_courtroom_courtesy(argument or "")
    if arg:
        low = arg.lower()
        if side == "prosecution" and (
            low.startswith("we contest")
            or low.startswith("our client")
            or low.startswith("defence submits")
        ):
            arg = f"The complainant's position: {arg}"
        elif side == "defence" and low.startswith("prosecution submits"):
            arg = f"The accused disputes the prosecution case: {arg}"

    return normed_steps, arg


def tag_follow_up_for_side(side: str, question: str) -> str:
    """Prefix cross-examination questions so the model and UI keep roles clear."""
    q = (question or "").strip()
    if not q:
        return q
    low = q.lower()
    if side == "prosecution":
        if low.startswith("to the defendant") or low.startswith("to the accused"):
            return q
        return f"To the Defendant/Accused: {q}"
    if side == "defence":
        if low.startswith("to the complainant") or low.startswith("to the user"):
            return q
        return f"To the Complainant: {q}"
    return q


def parse_agent_response(content: str) -> Dict[str, Any]:
    """Parse structured agent JSON; fall back to plain-text argument."""
    parsed = parse_json_from_text(content)
    if parsed:
        reasoning = _as_str_list(
            parsed.get("reasoning_steps")
            or parsed.get("reasoning")
            or parsed.get("logical_reasoning")
        )
        argument = str(
            parsed.get("argument")
            or parsed.get("answer")
            or parsed.get("submission")
            or parsed.get("courtroom_argument")
            or ""
        ).strip()
        law_sections = _as_str_list(parsed.get("law_sections") or parsed.get("statutes"))
        needs_q = bool(parsed.get("needs_clarification"))
        question = (
            parsed.get("follow_up_question")
            or parsed.get("question")
            or parsed.get("question_text")
        )
        if isinstance(question, dict):
            question = question.get("question") or question.get("text")
        if not argument and not needs_q:
            # Model returned JSON without a dedicated argument field — use non-meta text
            skip = {
                "reasoning_steps",
                "reasoning",
                "logical_reasoning",
                "law_sections",
                "statutes",
                "needs_clarification",
                "question",
                "question_text",
                "follow_up_question",
            }
            parts = [str(v) for k, v in parsed.items() if k not in skip and isinstance(v, str)]
            argument = "\n".join(parts).strip()
        follow_up = str(question).strip() if question else None
        return {
            "reasoning_steps": reasoning,
            "argument": argument or content.strip(),
            "law_sections": law_sections,
            "needs_clarification": needs_q,
            "question": follow_up,
            "follow_up_question": follow_up,
            "raw": content,
        }
    return {
        "reasoning_steps": [],
        "argument": content.strip(),
        "law_sections": [],
        "needs_clarification": False,
        "question": None,
        "follow_up_question": None,
        "raw": content,
    }


def extract_follow_up_question(
    parsed: Dict[str, Any],
    *,
    side: str,
    phase: str,
    argument: str,
    case_facts: str = "",
    opposition_arg: str = "",
    asked_questions: Optional[List[str]] = None,
) -> Optional[str]:
    """Return one new follow-up question only if novel and grounded in the debate."""
    if phase == "closing":
        return None

    asked = list(asked_questions or [])
    q = parsed.get("follow_up_question") or parsed.get("question")
    q_str = str(q).strip() if q is not None else ""
    if q_str.lower() in ("null", "none", "n/a", ""):
        q_str = ""
    if q_str:
        tagged = tag_follow_up_for_side(side, q_str)
        if is_duplicate_question(tagged, asked):
            return None
        return tagged

    # Only force a question when the model explicitly flags missing facts
    if parsed.get("needs_clarification"):
        snippet = (argument or opposition_arg or case_facts or "")[:120]
        if side == "defence":
            tagged = tag_follow_up_for_side(
                side,
                f"What specific fact or document in your complaint addresses: {snippet}?",
            )
        else:
            tagged = tag_follow_up_for_side(
                side,
                f"What is your response to this specific point: {snippet}?",
            )
        if is_duplicate_question(tagged, asked):
            return None
        return tagged

    return None


def check_clarification(content: str) -> Tuple[bool, Optional[str]]:
    parsed = parse_agent_response(content)
    if parsed.get("needs_clarification") and parsed.get("question"):
        return True, parsed["question"]
    return False, None


def new_question_id() -> str:
    return f"q_{uuid.uuid4().hex[:12]}"


def safe_float(value: Any, default: float = 0.0) -> float:
    """Parse numeric scores from LLM JSON; never return NaN."""
    if value is None:
        return float(default)
    if isinstance(value, (int, float)):
        n = float(value)
        return n if n == n else float(default)
    if isinstance(value, str):
        s = value.strip().replace("%", "")
        if not s:
            return float(default)
        try:
            n = float(s)
            return n if n == n else float(default)
        except ValueError:
            m = re.search(r"(\d+(?:\.\d+)?)", s)
            if m:
                n = float(m.group(1))
                return n if n == n else float(default)
    return float(default)


def _winner_from_scores(p_score: float, d_score: float) -> str:
    if p_score > d_score + 1.0:
        return "prosecution"
    if d_score > p_score + 1.0:
        return "defence"
    return "draw"


def append_logic_entries(
    logic_log: List[Dict[str, Any]],
    *,
    side: str,
    phase: str,
    reasoning_steps: List[str],
    law_sections: List[str],
    argument: str = "",
) -> List[Dict[str, Any]]:
    """Accumulate partisan reasoning the judge uses for differentiated scoring."""
    out = list(logic_log)
    for i, step in enumerate(reasoning_steps):
        if str(step).strip():
            out.append(
                {
                    "side": side,
                    "phase": phase,
                    "kind": "reasoning",
                    "content": str(step).strip(),
                    "law_sections": law_sections,
                    "index": i,
                }
            )
    if argument.strip():
        out.append(
            {
                "side": side,
                "phase": phase,
                "kind": "argument",
                "content": argument.strip(),
                "law_sections": law_sections,
            }
        )
    return out


def logic_log_for_phase(logic_log: List[Dict[str, Any]], phase: str) -> List[Dict[str, Any]]:
    return [e for e in logic_log if isinstance(e, dict) and e.get("phase") == phase]


def _text_strength(text: str, law_sections: Optional[List[str]] = None) -> float:
    """Heuristic persuasion score from argument text (partisan quality signals)."""
    t = (text or "").lower()
    score = 0.0
    if re.search(r"\b(section|sec\.|s\.)\s*\d+", t):
        score += 5.0
    if re.search(r"\b(ipc|crpc|cpc|ni act|contract act|consumer protection)", t):
        score += 4.0
    if re.search(r"\b(evidence|exhibit|document|record|proof|witness)", t):
        score += 3.0
    if re.search(r"\b(contest|rebut|deny|dispute|however|contrary|not established)", t):
        score += 2.5
    if re.search(r"\b(warranty|liquid|damage|breach|liability|offence)", t):
        score += 1.5
    score += min(len(t.split()), 80) / 10.0
    score += len(law_sections or []) * 2.0
    return score


def _side_phase_strength(
    side: str,
    phase: str,
    argument: str,
    logic_log: List[Dict[str, Any]],
) -> float:
    total = _text_strength(argument, [])
    for entry in logic_log_for_phase(logic_log, phase):
        if entry.get("side") != side:
            continue
        text = str(entry.get("content") or "")
        # Penalise if counsel argues from wrong role (e.g. defence text under prosecution)
        if side == "prosecution" and text.lower().startswith("defence:"):
            continue
        if side == "defence" and text.lower().startswith("prosecution:"):
            continue
        total += _text_strength(
            text,
            entry.get("law_sections") if isinstance(entry.get("law_sections"), list) else [],
        )
    return total


def _comparative_parameter_scores(
    phase: str,
    prosecution_arg: str,
    defence_arg: str,
    logic_log: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Build differentiated per-parameter scores from argument + logic log analysis."""
    p_power = _side_phase_strength("prosecution", phase, prosecution_arg, logic_log)
    d_power = _side_phase_strength("defence", phase, defence_arg, logic_log)
    margin = min(10.0, abs(p_power - d_power) / 2.5)
    p_leads = p_power >= d_power

    mid = 13.0
    if p_leads:
        base_p, base_d = mid + margin / 2, mid - margin / 2
    else:
        base_p, base_d = mid - margin / 2, mid + margin / 2

    # Per-parameter tweaks so rows are not identical
    offsets = {
        "legal_accuracy": (0.5, -0.5) if p_leads else (-0.5, 0.5),
        "statutory_application": (1.0, -1.0) if p_leads else (-1.0, 1.0),
        "coherence": (0.0, 0.0),
        "evidence_usage": (-0.5, 0.5) if p_leads else (0.5, -0.5),
        "procedural_soundness": (0.3, -0.3) if p_leads else (-0.3, 0.3),
    }

    parameters: List[Dict[str, Any]] = []
    for spec in JUDGE_PARAMETERS:
        pid = spec["id"]
        op, od = offsets.get(pid, (0.0, 0.0))
        p_score = min(20.0, max(4.0, base_p + op))
        d_score = min(20.0, max(4.0, base_d + od))
        if abs(p_score - d_score) < 3.0:
            if p_leads:
                p_score = min(20.0, d_score + 3.5)
            else:
                d_score = min(20.0, p_score + 3.5)
        winner = _winner_from_scores(p_score, d_score)
        stronger = "Prosecution" if p_leads else "Defence"
        parameters.append(
            {
                "parameter_id": pid,
                "parameter_label": spec["label"],
                "prosecution_score": round(p_score, 1),
                "defence_score": round(d_score, 1),
                "winner": winner,
                "rationale": (
                    f"{stronger} presented stronger partisan logic on {spec['label']} "
                    f"(counsel reasoning log reviewed)."
                ),
            }
        )
    return parameters


def _enforce_score_differentiation(parameters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure scores are not flat — widen gaps when model returned ties."""
    out: List[Dict[str, Any]] = []
    draws = 0
    for p in parameters:
        p_score = float(p["prosecution_score"])
        d_score = float(p["defence_score"])
        if abs(p_score - d_score) < 3.0:
            if p_score >= d_score:
                p_score = min(20.0, d_score + 3.5)
            else:
                d_score = min(20.0, p_score + 3.5)
        winner = str(p.get("winner") or _winner_from_scores(p_score, d_score)).lower()
        if winner == "draw":
            draws += 1
            if draws > 1:
                if p_score >= d_score:
                    p_score = min(20.0, d_score + 3.0)
                    winner = "prosecution"
                else:
                    d_score = min(20.0, p_score + 3.0)
                    winner = "defence"
        out.append({**p, "prosecution_score": round(p_score, 1), "defence_score": round(d_score, 1), "winner": winner})
    return out


def build_parameter_round_score(
    phase: str,
    prosecution_arg: str,
    defence_arg: str,
    parsed: Optional[Dict[str, Any]] = None,
    logic_log: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Per-parameter prosecution vs defence scores from judge JSON + logic log."""
    log = logic_log or []
    parameters: List[Dict[str, Any]] = []

    raw_params = []
    if parsed:
        raw_params = parsed.get("parameters") or parsed.get("parameter_scores") or []

    if isinstance(raw_params, dict):
        raw_params = [{"parameter_id": k, **(v if isinstance(v, dict) else {})} for k, v in raw_params.items()]

    by_id: Dict[str, Dict[str, Any]] = {}
    for item in raw_params if isinstance(raw_params, list) else []:
        if not isinstance(item, dict):
            continue
        pid = str(item.get("parameter_id") or item.get("id") or "").strip()
        if pid:
            by_id[pid] = item

    # Fallback: comparative analysis from arguments + logic log (never flat equal)
    comparative = {
        p["parameter_id"]: p for p in _comparative_parameter_scores(phase, prosecution_arg, defence_arg, log)
    }

    for spec in JUDGE_PARAMETERS:
        pid = spec["id"]
        raw = by_id.get(pid, {})
        comp = comparative.get(pid, {})
        p_score = safe_float(
            raw.get("prosecution_score") or raw.get("prosecution"),
            comp.get("prosecution_score", 12.0),
        )
        d_score = safe_float(
            raw.get("defence_score") or raw.get("defence"),
            comp.get("defence_score", 12.0),
        )
        p_score = min(20.0, max(0.0, p_score))
        d_score = min(20.0, max(0.0, d_score))
        winner = str(raw.get("winner") or comp.get("winner") or _winner_from_scores(p_score, d_score)).lower()
        if winner not in ("prosecution", "defence", "draw"):
            winner = _winner_from_scores(p_score, d_score)
        parameters.append(
            {
                "parameter_id": pid,
                "parameter_label": spec["label"],
                "prosecution_score": round(p_score, 1),
                "defence_score": round(d_score, 1),
                "winner": winner,
                "rationale": str(
                    raw.get("rationale")
                    or comp.get("rationale")
                    or f"Compared on {spec['label']} for this phase."
                )[:280],
            }
        )

    parameters = _enforce_score_differentiation(parameters)

    p_avg = sum(x["prosecution_score"] for x in parameters) / max(len(parameters), 1)
    d_avg = sum(x["defence_score"] for x in parameters) / max(len(parameters), 1)
    round_winner = _winner_from_scores(p_avg, d_avg)
    if parsed:
        rw = str(parsed.get("round_winner") or "").lower()
        if rw in ("prosecution", "defence", "draw"):
            round_winner = rw
    bench_note = ""
    if parsed:
        bench_note = str(parsed.get("bench_note") or parsed.get("summary") or "").strip()
    if not bench_note:
        bench_note = (
            f"Prosecution avg {p_avg:.1f} vs Defence avg {d_avg:.1f} on "
            f"{phase.replace('_', ' ')}."
        )

    # Legacy aggregate fields for sidebar compatibility
    la = next((x for x in parameters if x["parameter_id"] == "legal_accuracy"), parameters[0])
    co = next((x for x in parameters if x["parameter_id"] == "coherence"), parameters[0])
    ev = next((x for x in parameters if x["parameter_id"] == "evidence_usage"), parameters[0])
    pr = next(
        (x for x in parameters if x["parameter_id"] == "procedural_soundness"), parameters[0]
    )
    st = next(
        (x for x in parameters if x["parameter_id"] == "statutory_application"), parameters[0]
    )

    return {
        "phase": phase,
        "parameters": parameters,
        "prosecution_average": round(p_avg, 1),
        "defence_average": round(d_avg, 1),
        "round_winner": round_winner,
        "bench_note": bench_note,
        "legal_accuracy": la["prosecution_score"],
        "coherence": co["prosecution_score"],
        "evidence_usage": ev["prosecution_score"],
        "procedural_soundness": pr["prosecution_score"],
        "phase_fulfillment": st["prosecution_score"],
        "round_total": round(p_avg * 5, 1),
    }


def aggregate_final_scores(rounds: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Sum parameter scores across rounds; overall winner = higher average."""
    totals: Dict[str, Dict[str, float]] = {}
    counts: Dict[str, int] = {}

    for r in rounds:
        if not isinstance(r, dict):
            continue
        for p in r.get("parameters") or []:
            if not isinstance(p, dict):
                continue
            pid = p.get("parameter_id")
            if not pid:
                continue
            totals.setdefault(pid, {"prosecution": 0.0, "defence": 0.0})
            totals[pid]["prosecution"] += safe_float(p.get("prosecution_score"))
            totals[pid]["defence"] += safe_float(p.get("defence_score"))
            counts[pid] = counts.get(pid, 0) + 1

    param_defs = {p["id"]: p for p in JUDGE_PARAMETERS}
    parameter_totals: List[Dict[str, Any]] = []
    p_grand = 0.0
    d_grand = 0.0

    for pid, spec in param_defs.items():
        if pid not in totals:
            continue
        n = max(counts.get(pid, 1), 1)
        p_avg = totals[pid]["prosecution"] / n
        d_avg = totals[pid]["defence"] / n
        p_grand += p_avg
        d_grand += d_avg
        parameter_totals.append(
            {
                "parameter_id": pid,
                "parameter_label": spec["label"],
                "prosecution_score": round(p_avg, 1),
                "defence_score": round(d_avg, 1),
                "winner": _winner_from_scores(p_avg, d_avg),
                "rationale": f"Cumulative average across all phases on {spec['label']}.",
            }
        )

    n_params = max(len(parameter_totals), 1)
    prosecution_overall = p_grand / n_params
    defence_overall = d_grand / n_params
    declared = _winner_from_scores(prosecution_overall, defence_overall)

    return {
        "parameter_totals": parameter_totals,
        "prosecution_overall_average": round(prosecution_overall, 1),
        "defence_overall_average": round(defence_overall, 1),
        "declared_winner": declared,
    }


def normalize_round_score(
    phase: str,
    prosecution_arg: str,
    defence_arg: str,
    parsed: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Backward-compatible wrapper."""
    return build_parameter_round_score(phase, prosecution_arg, defence_arg, parsed)
