"use client";

import { useEffect, useRef } from "react";
import type { ClashEntry } from "@/hooks/useClashStream";
import type { AgentSide } from "@/lib/clashApi";
import { ClashMessageBubble } from "./ClashMessageBubble";
import { ClashQuestionCard } from "./ClashQuestionCard";
import { ClashReasoningBlock } from "./ClashReasoningBlock";
import { ClashParametersPanel } from "./ClashParametersPanel";
import { ClashRoundScoreCard } from "./ClashRoundScoreCard";
import { ClashJudgmentCard } from "./ClashJudgmentCard";

export function ClashDebateTranscript({
  entries,
  isStreaming,
  pendingQuestion,
  onSubmitAnswer,
}: {
  entries: ClashEntry[];
  isStreaming: boolean;
  pendingQuestion: {
    questionId: string;
    text: string;
    side: AgentSide;
    phase?: string;
    lawSections?: string[];
    questionTarget: "user" | "defence";
  } | null;
  onSubmitAnswer: (questionId: string, answer: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, isStreaming, pendingQuestion]);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 custom-scrollbar-emerald"
      aria-live="polite"
      aria-label="Debate canvas"
    >
      <div
        className="pointer-events-none absolute top-0 bottom-0 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent md:block"
        aria-hidden
      />

      {entries.length === 0 && !isStreaming && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Submit a case and start the debate to see logical reasoning, arguments, and
          bench scoring in the canvas.
        </div>
      )}

      {entries.map((entry) => {
        if (entry.kind === "parameters") {
          return (
            <ClashParametersPanel key={entry.id} parameters={entry.parameters} />
          );
        }
        if (entry.kind === "reasoning") {
          return (
            <ClashReasoningBlock
              key={entry.id}
              side={entry.side}
              phase={entry.phase}
              content={entry.content}
              lawSections={entry.lawSections}
              stepIndex={entry.stepIndex}
            />
          );
        }
        if (entry.kind === "stream") {
          return (
            <ClashMessageBubble
              key={entry.id}
              side={entry.side}
              phase={entry.phase}
              content={entry.content}
              streaming={!entry.finalized && isStreaming}
            />
          );
        }
        if (entry.kind === "question") {
          return (
            <ClashQuestionCard
              key={entry.id}
              side={entry.side}
              phase={entry.phase}
              questionId={entry.questionId}
              text={entry.text}
              quickReplies={entry.quickReplies}
              lawSections={entry.lawSections}
              questionTarget={entry.questionTarget}
              answered={entry.answered}
              onSubmit={onSubmitAnswer}
              disabled={isStreaming}
            />
          );
        }
        if (entry.kind === "cross_answer") {
          return (
            <div key={entry.id} className="mb-3 flex w-full justify-start">
              <div className="max-w-[85%] rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950">
                <span className="text-xs font-bold uppercase text-amber-800">
                  Defence (Defendant):{" "}
                </span>
                {entry.text}
              </div>
            </div>
          );
        }
        if (entry.kind === "answer") {
          return (
            <div key={entry.id} className="mb-3 flex w-full justify-end">
              <div className="max-w-[80%] rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                <span className="font-bold text-primary">
                  {entry.label || "Complainant"}:{" "}
                </span>
                {entry.text}
              </div>
            </div>
          );
        }
        if (entry.kind === "round_score") {
          return <ClashRoundScoreCard key={entry.id} scores={entry.scores} />;
        }
        if (entry.kind === "judge_verdict") {
          return (
            <ClashJudgmentCard
              key={entry.id}
              result={entry.result}
              streaming={entry.streaming}
              partialContent={entry.content}
            />
          );
        }
        if (entry.kind === "final") {
          const hasVerdict = entries.some((e) => e.kind === "judge_verdict");
          if (hasVerdict) return null;
          return (
            <ClashJudgmentCard
              key={entry.id}
              result={entry.result}
              streaming={false}
            />
          );
        }
        if (entry.kind === "system") {
          return (
            <p
              key={entry.id}
              className="my-1.5 text-center text-[10px] text-muted-foreground"
            >
              {entry.content}
            </p>
          );
        }
        return null;
      })}

      {pendingQuestion &&
        pendingQuestion.questionTarget === "user" &&
        !entries.some(
          (e) => e.kind === "question" && e.questionId === pendingQuestion.questionId
        ) && (
          <ClashQuestionCard
            side={pendingQuestion.side}
            phase={pendingQuestion.phase}
            questionId={pendingQuestion.questionId}
            text={pendingQuestion.text}
            lawSections={pendingQuestion.lawSections}
            questionTarget="user"
            onSubmit={onSubmitAnswer}
            disabled={isStreaming}
          />
        )}

      <div ref={bottomRef} />
    </div>
  );
}
