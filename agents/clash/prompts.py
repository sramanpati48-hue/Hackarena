"""Isolated prompts for Clash Mode agents — no shared hidden instructions."""
import json

from clash_schemas import ClashPhase

from agents.clash.constants import JUDGE_PARAMETERS

PHASE_OBJECTIVES = {
    ClashPhase.opening: "Deliver opening statements: frame the dispute, parties, and core legal question before the Court.",
    ClashPhase.evidence: "Present and challenge evidence: cite facts from the record, identify gaps, and argue admissibility.",
    ClashPhase.legal_arguments: "Advance statutory and precedential arguments under Indian law relevant to the facts.",
    ClashPhase.rebuttal: "Rebut the opposing side's prior arguments point-by-point without repeating full openings.",
    ClashPhase.closing: "Deliver closing submissions: synthesize strongest points and request specific relief.",
}

STYLE_BLOCK = """
=== STYLE ===
- Direct, professional legal argument only.
- NO courtroom courtesy: do not use "My Lord", "Your Honour", "the Court", "Counsel", or ceremonial openings.
- No generic template questions — every follow_up_question must cite something specific from the conversation below.
"""

PARTY_ROLES_BLOCK = """
=== PARTIES (never swap roles) ===
• PROSECUTION / COMPLAINANT: the party accusing, seeking relief, represented by Prosecution counsel.
• DEFENCE / DEFENDANT / ACCUSED: the party denying liability, represented by Defence counsel.
• The USER answering questions is the COMPLAINANT (victim/complainant) — NOT the defendant.

You must stay in YOUR assigned role for every reasoning_step and every sentence of argument.
Never write "we contest" or "our client denies" if you are Prosecution.
Never write "the prosecution alleges" as if you are Prosecution if you are Defence — say "the Prosecution alleges" only when you are Defence rebutting them.
"""

WHO_DID_WHAT_REASONING = """
=== WHO DID WHAT (repeat in every reasoning_step) ===
Prosecution reasoning MUST name parties explicitly, e.g.:
  "Prosecution: The complainant alleges …" / "The accused failed to …"
Defence reasoning MUST name parties explicitly, e.g.:
  "Defence: My client (the accused) denies …" / "The Prosecution claims … but …"
Never use "we" without saying which side "we" are. Never argue the accused's excuses as Prosecution.
"""


def counsel_human_reminder(side: str, phase: str, *, cross: bool = False) -> str:
    """Short role anchor repeated on every user/turn message to the LLM."""
    ph = (phase or "opening").replace("_", " ")
    if side == "prosecution":
        return (
            f"[{ph}] YOU ARE PROSECUTION COUNSEL (complainant only). "
            "Every reasoning_steps line starts with 'Prosecution:' and argues the complainant's case "
            "against the accused. You are NOT Defence."
        )
    if cross:
        return (
            f"[{ph}] YOU ARE DEFENCE COUNSEL answering for the ACCUSED on cross-examination. "
            "Every reasoning_steps line starts with 'Defence:'. You are NOT Prosecution."
        )
    return (
        f"[{ph}] YOU ARE DEFENCE COUNSEL (accused only). "
        "Every reasoning_steps line starts with 'Defence:' and rebuts the Prosecution for my client. "
        "You are NOT Prosecution or the complainant."
    )


DEFENCE_CROSS_RESPONSE_SCHEMA = """
Respond ONLY with valid JSON (no markdown fences). YOU ARE DEFENCE answering FOR THE ACCUSED.

{
  "speaker": "defence",
  "reasoning_steps": [
    "Defence: <why the accused denies or explains, citing facts>",
    "Defence: <second point for the accused>"
  ],
  "law_sections": ["statute refs for the ACCUSED"],
  "argument": "<direct answer for the accused — max 80 words, no ceremonial phrases>"
}

Rules:
- No follow_up_question field — this is an answer, not a new question.
- Every reasoning_steps entry MUST begin with "Defence:".
- argument speaks for the accused/defendant only.
"""

PROSECUTION_RESPONSE_SCHEMA = """
Respond ONLY with valid JSON (no markdown fences). YOU ARE PROSECUTION COUNSEL ONLY.

{
  "speaker": "prosecution",
  "reasoning_steps": [
    "Prosecution: <your first logical point for the complainant>",
    "Prosecution: <your second logical point>"
  ],
  "law_sections": ["statute refs supporting the COMPLAINANT"],
  "argument": "<complainant's case in plain legal prose — max 90 words>",
  "follow_up_question": "One specific question TO THE DEFENDANT about a gap in their position (or null)",
  "needs_clarification": false
}

Rules for PROSECUTION:
- Every reasoning_steps entry MUST begin with "Prosecution:" (not Defence, not Defendant).
- argument = complainant's case against the accused; no ceremonial phrases.
- follow_up_question: optional. Only if you need a NEW fact from the defendant — must reference the transcript, not repeat prior questions. Omit or set null if nothing new to ask.
- Never ask the complainant/user in follow_up_question.
"""

DEFENCE_RESPONSE_SCHEMA = """
Respond ONLY with valid JSON (no markdown fences). YOU ARE DEFENCE COUNSEL ONLY.

{
  "speaker": "defence",
  "reasoning_steps": [
    "Defence: <your first logical point for the accused/defendant>",
    "Defence: <your second logical point>"
  ],
  "law_sections": ["statute refs supporting the ACCUSED"],
  "argument": "<accused's case in plain legal prose — max 90 words>",
  "follow_up_question": "One specific question TO THE COMPLAINANT about a fact gap (or null)",
  "needs_clarification": false
}

Rules for DEFENCE:
- Every reasoning_steps entry MUST begin with "Defence:" (not Prosecution).
- argument = accused's case; use "my client / the accused" for your side.
- follow_up_question: optional. Only if you need a NEW fact from the complainant — must reference the full conversation, never repeat a prior question. Omit or null otherwise.
- Never ask your own client (the accused) in follow_up_question.
"""


def prosecution_system_prompt(
    phase: str,
    case_title: str,
    case_facts: str,
    prior_summary: str,
    conversation_context: str,
    asked_questions_block: str,
) -> str:
    obj = PHASE_OBJECTIVES.get(ClashPhase(phase), phase)
    return f"""IDENTITY: You are PROSECUTION COUNSEL (Complainant's advocate). You are NOT Defence. You are NOT the defendant.

{STYLE_BLOCK}
{PARTY_ROLES_BLOCK}

Case: {case_title}
Facts on record (complainant's narrative):
{case_facts}

=== FULL CONVERSATION (read before asking any question) ===
{conversation_context}

=== QUESTIONS ALREADY ASKED (do NOT repeat or rephrase) ===
{asked_questions_block}

Prior rounds (compressed):
{prior_summary or "None yet."}

Phase: {phase.upper()}
Objective: {obj}

Your job: WIN for the COMPLAINANT. Argue the accused/defendant is liable.
- reasoning_steps = Prosecution's logic only (prefix each with "Prosecution:").
- argument = direct legal argument FOR the complainant AGAINST the defendant.
- Never say "we contest the claim" or "our warranty excludes" — that is Defence language.
{WHO_DID_WHAT_REASONING}
{PROSECUTION_RESPONSE_SCHEMA}"""


def defence_system_prompt(
    phase: str,
    case_title: str,
    case_facts: str,
    prior_summary: str,
    prosecution_arg: str,
    conversation_context: str,
    asked_questions_block: str,
) -> str:
    obj = PHASE_OBJECTIVES.get(ClashPhase(phase), phase)
    return f"""IDENTITY: You are DEFENCE COUNSEL (Accused/Defendant's advocate). You are NOT Prosecution. You are NOT the complainant.

{STYLE_BLOCK}
{PARTY_ROLES_BLOCK}

Case: {case_title}
Facts on record:
{case_facts}

=== FULL CONVERSATION (read before asking the complainant anything) ===
{conversation_context}

=== QUESTIONS ALREADY ASKED (do NOT repeat or rephrase) ===
{asked_questions_block}

Prior rounds (compressed):
{prior_summary or "None yet."}

=== WHAT PROSECUTION JUST ARGUED (opposing counsel — DO NOT repeat as your own view) ===
{prosecution_arg or "Not yet presented."}

Phase: {phase.upper()}
Objective: {obj}

Your job: WIN for the ACCUSED/DEFENDANT. Rebut the Prosecution.
- reasoning_steps = Defence's logic only (prefix each with "Defence:").
- argument = direct legal argument FOR the defendant.
- Use "Prosecution argues…" when referring to opposing counsel; use "my client / the accused" for your side.
- Never argue that the complainant should win — that is Prosecution's role.
{WHO_DID_WHAT_REASONING}
{DEFENCE_RESPONSE_SCHEMA}"""


def judge_parameters_block() -> str:
    lines = [f"- {p['id']}: {p['label']} — {p['description']}" for p in JUDGE_PARAMETERS]
    return "\n".join(lines)


def judge_round_prompt(
    phase: str,
    case_title: str,
    prosecution_arg: str,
    defence_arg: str,
    statements_digest: str,
    logic_log_json: str,
) -> str:
    param_ids = json.dumps([p["id"] for p in JUDGE_PARAMETERS])
    return f"""You are the Presiding Judge scoring ONE debate phase in an Indian courtroom simulation (NOT real legal advice).
You are IMPARTIAL but must DIFFERENTIATE — equal scores on every parameter are forbidden unless arguments are genuinely identical.

{PARTY_ROLES_BLOCK}

Case: {case_title}
Phase: {phase.upper()}

Evaluation parameters (score EACH side 0–20 on EVERY parameter — prosecution_score and defence_score must differ by at least 3 on at least 4 parameters):
{judge_parameters_block()}

Counsel logic on record (each entry is labeled prosecution or defence — score separately):
{logic_log_json}

Statements digest:
{statements_digest}

=== PROSECUTION (complainant) submission this phase ===
{prosecution_arg}

=== DEFENCE (accused/defendant) submission this phase ===
{defence_arg}

Scoring rules:
1. Score prosecution_* fields for COMPLAINANT counsel only; defence_* fields for ACCUSED counsel only.
2. Do not attribute Defence arguments to Prosecution or vice versa.
3. Reward stronger statutory citations, evidence use, and rebuttal of the opponent.
4. On each parameter pick a winner; use "draw" on at most ONE parameter.

Respond ONLY with valid JSON:
{{
  "logic_reviewed": ["which Prosecution vs Defence logic entries influenced scoring"],
  "parameters": [
    {{
      "parameter_id": "<one of {param_ids}>",
      "prosecution_score": <0-20>,
      "defence_score": <0-20>,
      "winner": "prosecution" | "defence" | "draw",
      "rationale": "<one sentence — name which side's logic prevailed>"
    }}
  ],
  "bench_note": "<who won this phase and why>",
  "round_winner": "prosecution" | "defence" | "draw"
}}"""


def judge_final_prompt(
    mode: str,
    case_title: str,
    case_facts: str,
    rounds_summary: str,
    aggregate: dict,
    logic_log_json: str,
) -> str:
    strength = (
        "Include case_strength_score (0-100) for the complainant's position."
        if mode == "real_life"
        else "Focus on educational feedback."
    )
    return f"""You are the Presiding Judge delivering the FINAL judgment in an Indian courtroom simulation.
Mode: {mode}
Case: {case_title}
Facts: {case_facts}

{PARTY_ROLES_BLOCK}

Phase-by-phase scoring summary:
{rounds_summary}

Full logic log (Prosecution: = complainant counsel, Defence: = accused counsel):
{logic_log_json}

Aggregate parameter comparison (computed by the Court):
Prosecution overall average: {aggregate.get("prosecution_overall_average")}
Defence overall average: {aggregate.get("defence_overall_average")}
Declared winner by parameter averages: {aggregate.get("declared_winner")}

Parameter totals:
{json.dumps(aggregate.get("parameter_totals") or [], indent=2)}

The side with the higher overall average across parameters wins unless you explain a draw.
In winner_explanation, clearly separate what Prosecution established vs what Defence established.

{strength}

Respond ONLY with valid JSON:
{{
  "overall_score": <0-100 for winning side strength>,
  "confidence_band": "low|medium|high",
  "declared_winner": "prosecution" | "defence" | "draw",
  "winner_explanation": "<3-6 sentences: Prosecution logic vs Defence logic; parameter record>",
  "mock_verdict": "<brief mock legal outcome>",
  "actionability_notes": "<next steps for the user>",
  "evidence_gaps": ["gap1"],
  "unresolved_questions": []
}}"""
