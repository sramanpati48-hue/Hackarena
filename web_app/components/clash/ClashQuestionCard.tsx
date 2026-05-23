"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AgentSide } from "@/lib/clashApi";
import { HelpCircle, Send, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ClashQuestionCard({
  side,
  phase,
  questionId,
  text,
  quickReplies = [],
  lawSections = [],
  questionTarget = "user",
  answered,
  onSubmit,
  disabled,
}: {
  side: AgentSide;
  phase?: string;
  questionId: string;
  text: string;
  quickReplies?: string[];
  lawSections?: string[];
  questionTarget?: "user" | "defence";
  answered?: boolean;
  onSubmit: (questionId: string, answer: string) => void;
  disabled?: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const isProsecution = side === "prosecution";
  const toDefendant = questionTarget === "defence";
  const needsUserInput = !toDefendant;

  if (answered) {
    return null;
  }

  return (
    <div
      className={cn(
        "mb-5 flex w-full",
        isProsecution ? "justify-end" : "justify-start"
      )}
      role="region"
      aria-label={
        toDefendant
          ? "Prosecution question to defendant"
          : "Defence question to complainant"
      }
    >
      <div
        className={cn(
          "max-w-[92%] rounded-2xl border-2 p-4 shadow-md sm:max-w-[78%]",
          isProsecution
            ? "border-r-4 border-r-primary border-border bg-primary/5"
            : "border-l-4 border-l-amber-500 border-border bg-amber-50/80"
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <HelpCircle
            className={cn("size-4", isProsecution ? "text-primary" : "text-amber-600")}
            aria-hidden
          />
          <span className="text-xs font-bold uppercase text-muted-foreground">
            {isProsecution
              ? "Prosecution → Defendant"
              : "Defence → Complainant (you)"}
          </span>
          {phase && (
            <Badge variant="outline" className="text-[10px] capitalize">
              {phase.replace(/_/g, " ")}
            </Badge>
          )}
        </div>

        {lawSections.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {lawSections.map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        )}

        <p className="mb-3 text-sm font-medium text-foreground">{text}</p>

        {toDefendant ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
            <MessageSquare className="size-3.5 shrink-0" aria-hidden />
            Awaiting Defence counsel&apos;s response…
          </p>
        ) : (
          <>
            {quickReplies.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {quickReplies.map((q) => (
                  <Button
                    key={q}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onSubmit(questionId, q)}
                    disabled={disabled}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your answer as complainant (facts for the Court)…"
                aria-label="Answer to defence counsel"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && answer.trim()) {
                    onSubmit(questionId, answer.trim());
                    setAnswer("");
                  }
                }}
                disabled={disabled}
                className="text-sm"
              />
              <Button
                type="button"
                size="icon"
                onClick={() => {
                  if (answer.trim()) {
                    onSubmit(questionId, answer.trim());
                    setAnswer("");
                  }
                }}
                disabled={disabled || !answer.trim()}
                aria-label="Submit answer"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
