/** Same-origin Next.js proxy routes (see web_app/app/api/clash/). */
function clashApiBase(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export type ClashMode = "practice" | "real_life";
export type AgentSide = "prosecution" | "defence" | "judge" | "system";
export type DeclaredWinner = "prosecution" | "defence" | "draw";

export interface ClashMockCase {
  id: string;
  title: string;
  summary: string;
  facts: string;
  tags: string[];
}

export interface JudgeParameter {
  id: string;
  label: string;
  description?: string;
}

export interface ParameterScore {
  parameter_id: string;
  parameter_label: string;
  prosecution_score: number;
  defence_score: number;
  winner: DeclaredWinner;
  rationale: string;
}

export interface JudgeScore {
  phase?: string;
  legal_accuracy: number;
  coherence: number;
  evidence_usage: number;
  procedural_soundness: number;
  phase_fulfillment: number;
  round_total: number;
  bench_note?: string;
  parameters?: ParameterScore[];
  prosecution_average?: number;
  defence_average?: number;
  round_winner?: DeclaredWinner;
}

export interface FinalClashResult {
  overall_score: number;
  confidence_band: string;
  mock_verdict: string;
  declared_winner: DeclaredWinner;
  winner_explanation: string;
  actionability_notes: string;
  evidence_gaps: string[];
  unresolved_questions: string[];
  round_scores?: JudgeScore[];
  judge_parameters?: JudgeParameter[];
  parameter_totals?: ParameterScore[];
  prosecution_overall_average?: number;
  defence_overall_average?: number;
}

export interface ClashStreamEvent {
  event_type: string;
  session_id: string;
  mode: ClashMode;
  agent_side: AgentSide;
  phase?: string;
  content?: string;
  payload?: Record<string, unknown>;
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function createClashSession(mode: ClashMode, userId?: string) {
  return parseJson<{ session_id: string; mode: ClashMode; status: string }>(
    await fetch(`${clashApiBase()}/api/clash/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, user_id: userId }),
    })
  );
}

export async function fetchMockCases() {
  const data = await parseJson<{ cases: ClashMockCase[] }>(
    await fetch(`${clashApiBase()}/api/clash/mock-cases`)
  );
  return data.cases;
}

export async function attachClashCase(
  sessionId: string,
  body: { title: string; facts: string; mock_case_id?: string }
) {
  return parseJson<Record<string, unknown>>(
    await fetch(`${clashApiBase()}/api/clash/sessions/${sessionId}/case`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export function streamClashDebate(sessionId: string): Promise<Response> {
  return fetch(`${clashApiBase()}/api/clash/sessions/${sessionId}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export function streamClashAnswer(
  sessionId: string,
  questionId: string,
  answer: string
): Promise<Response> {
  return fetch(`${clashApiBase()}/api/clash/sessions/${sessionId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_id: questionId, answer }),
  });
}
