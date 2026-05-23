"use client";

import type { FinalClashResult, JudgeScore } from "@/lib/clashApi";
import {
  computeJudgmentWeights,
  MAX_CLASH_ROUNDS,
} from "@/lib/clashVerdictWeights";

const PROSECUTION_COLOR = "#34d399";
const DEFENCE_COLOR = "#fbbf24";

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): string {
  if (endDeg - startDeg >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  }
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

export function ClashVerdictPieChart({
  finalResult,
  roundScores,
}: {
  finalResult: FinalClashResult;
  roundScores: JudgeScore[];
}) {
  const weights = computeJudgmentWeights(finalResult, roundScores);
  const { prosecutionPct, defencePct, prosecution, defence } = weights;

  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = 46;

  const prosecutionEnd = (prosecutionPct / 100) * 360;
  const paths: { d: string; fill: string; label: string }[] = [];

  if (prosecutionPct > 0) {
    paths.push({
      d: slicePath(cx, cy, r, 0, prosecutionEnd),
      fill: PROSECUTION_COLOR,
      label: `Prosecution ${prosecutionPct}%`,
    });
  }
  if (defencePct > 0) {
    paths.push({
      d: slicePath(cx, cy, r, prosecutionEnd, 360),
      fill: DEFENCE_COLOR,
      label: `Defence ${defencePct}%`,
    });
  }

  const chartLabel = `Judgment weight: Prosecution ${prosecutionPct} percent, Defence ${defencePct} percent`;

  return (
    <div className="rounded-lg bg-white/10 border border-white/15 p-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider opacity-90 mb-2 text-center">
        Judgment weight (3 rounds max)
      </p>
      <div className="flex flex-col items-center gap-2">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={chartLabel}
          className="drop-shadow-sm"
        >
          <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.08)" />
          {paths.map((p) => (
            <path key={p.label} d={p.d} fill={p.fill} stroke="rgba(0,0,0,0.15)" strokeWidth={0.5}>
              <title>{p.label}</title>
            </path>
          ))}
          <circle cx={cx} cy={cy} r={22} fill="#00634B" />
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            className="fill-white text-[9px] font-bold"
            style={{ fontSize: 9 }}
          >
            Bench
          </text>
          <text
            x={cx}
            y={cy + 9}
            textAnchor="middle"
            className="fill-white/80"
            style={{ fontSize: 7 }}
          >
            split
          </text>
        </svg>

        <ul className="w-full space-y-1 text-[10px]" aria-hidden={false}>
          <li className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: PROSECUTION_COLOR }}
              />
              <span className="truncate opacity-95">Prosecution</span>
            </span>
            <span className="font-bold tabular-nums shrink-0">{prosecutionPct}%</span>
          </li>
          <li className="flex items-center justify-between gap-2 text-[9px] opacity-80 pl-4">
            <span className="truncate">avg {prosecution.toFixed(1)}/20</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: DEFENCE_COLOR }}
              />
              <span className="truncate opacity-95">Defence</span>
            </span>
            <span className="font-bold tabular-nums shrink-0">{defencePct}%</span>
          </li>
          <li className="flex items-center justify-between gap-2 text-[9px] opacity-80 pl-4">
            <span className="truncate">avg {defence.toFixed(1)}/20</span>
          </li>
        </ul>
      </div>
      <p className="text-[8px] text-center opacity-70 mt-1.5 leading-snug">
        Share of total parameter score — higher slice = stronger bench favor
      </p>
    </div>
  );
}
