"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Swords, Loader2, Play } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { ClashMode, ClashMockCase } from "@/lib/clashApi";
import {
  attachClashCase,
  createClashSession,
  fetchMockCases,
} from "@/lib/clashApi";
import { useClashStream } from "@/hooks/useClashStream";
import { ClashModeSelector } from "./ClashModeSelector";
import { MockCasePicker } from "./MockCasePicker";
import { CaseInputForm } from "./CaseInputForm";
import { ClashDebateTranscript } from "./ClashDebateTranscript";
import { ClashBenchSidebar } from "./ClashBenchSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

type Step = "setup" | "debate";

export function ClashPageShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const initialMode =
    (searchParams.get("mode") as ClashMode) === "real_life" ? "real_life" : "practice";

  const [mode, setMode] = useState<ClashMode>(initialMode);
  const [step, setStep] = useState<Step>("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mockCases, setMockCases] = useState<ClashMockCase[]>([]);
  const [selectedMock, setSelectedMock] = useState<ClashMockCase | null>(null);
  const [title, setTitle] = useState("");
  const [facts, setFacts] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const debateStartedRef = useRef(false);

  const {
    entries,
    isStreaming,
    error,
    currentPhase,
    roundScores,
    finalResult,
    pendingQuestion,
    startDebate,
    submitAnswer,
    resetTranscript,
  } = useClashStream(sessionId, mode);

  const canvasEntries = entries;

  useEffect(() => {
    fetchMockCases().then(setMockCases).catch(console.error);
  }, []);

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "practice" || m === "real_life") setMode(m);
  }, [searchParams]);

  const onModeChange = (m: ClashMode) => {
    setMode(m);
    router.replace(`/clash?mode=${m}`, { scroll: false });
  };

  const handleSelectMock = (c: ClashMockCase) => {
    setSelectedMock(c);
    setTitle(c.title);
    setFacts(c.facts);
  };

  const handleStart = useCallback(async () => {
    setPrepareError(null);
    setIsPreparing(true);
    try {
      const t = title.trim() || selectedMock?.title || "Untitled Matter";
      const f = facts.trim() || selectedMock?.facts || "";
      if (f.length < 10) {
        setPrepareError(
          "Please provide at least a short description of the case facts."
        );
        setIsPreparing(false);
        return;
      }

      const session = await createClashSession(mode, user?.uid);
      await attachClashCase(session.session_id, {
        title: t,
        facts: f,
        mock_case_id: selectedMock?.id,
      });
      setSessionId(session.session_id);
      resetTranscript();
      setStep("debate");
      setIsPreparing(false);
    } catch (e) {
      setPrepareError(e instanceof Error ? e.message : "Failed to start");
      setIsPreparing(false);
    }
  }, [title, facts, selectedMock, mode, user?.uid, resetTranscript]);

  useEffect(() => {
    if (
      step === "debate" &&
      sessionId &&
      !debateStartedRef.current &&
      !isStreaming &&
      !finalResult
    ) {
      debateStartedRef.current = true;
      startDebate();
    }
  }, [step, sessionId, isStreaming, finalResult, startDebate]);

  useEffect(() => {
    if (step === "setup") debateStartedRef.current = false;
  }, [step]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b bg-card px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Swords className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Clash Mode
              </h1>
              <p className="text-sm text-muted-foreground">
                {mode === "practice" ? "Practice" : "Real Life"} · live debate
              </p>
            </div>
          </div>

          {step === "setup" ? (
            <ClashModeSelector mode={mode} onChange={onModeChange} />
          ) : (
            currentPhase && (
              <Badge variant="secondary" className="w-fit capitalize">
                {currentPhase.replace(/_/g, " ")}
              </Badge>
            )
          )}
        </div>
      </header>

      {step === "setup" ? (
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar-emerald">
          <div className="mx-auto w-full max-w-2xl space-y-6 p-4 pb-8 sm:p-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {mode === "practice" ? "Practice courtroom" : "Your case"}
                </CardTitle>
                <CardDescription>
                  {mode === "practice"
                    ? "Pick a mock case or write your own. Fast back-and-forth debate with a final bench ruling."
                    : "Describe your incident. Advocates debate; the bench scores and gives a mock verdict at the end."}
                </CardDescription>
              </CardHeader>
            </Card>

            {mode === "practice" && mockCases.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-foreground">Mock cases</h2>
                <MockCasePicker
                  cases={mockCases}
                  selectedId={selectedMock?.id}
                  onSelect={handleSelectMock}
                />
              </section>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Case details</CardTitle>
              </CardHeader>
              <CardContent>
                <CaseInputForm
                  title={title}
                  facts={facts}
                  onTitleChange={setTitle}
                  onFactsChange={setFacts}
                  mode={mode}
                />
              </CardContent>
            </Card>

            {prepareError && (
              <Alert variant="destructive">
                <AlertDescription>{prepareError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                size="lg"
                onClick={handleStart}
                disabled={isPreparing}
                className="sm:min-w-[180px]"
              >
                {isPreparing ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Play aria-hidden />
                )}
                Begin Debate
              </Button>
              <p className="text-xs text-muted-foreground">
                Simulation only — not legal advice.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ClashDebateTranscript
              entries={canvasEntries}
              isStreaming={isStreaming}
              pendingQuestion={pendingQuestion}
              onSubmitAnswer={submitAnswer}
            />
            <Separator />
            <div className="flex shrink-0 items-center justify-between gap-3 bg-card px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                {isStreaming && (
                  <Loader2
                    className="size-4 shrink-0 animate-spin text-primary"
                    aria-hidden
                  />
                )}
                <span className="truncate">
                  {error ||
                    (isStreaming
                      ? "Live debate…"
                      : finalResult
                        ? "Debate complete"
                        : "Ready")}
                </span>
              </div>
              {finalResult && !isStreaming && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep("setup");
                    setSessionId(null);
                    resetTranscript();
                  }}
                >
                  New debate
                </Button>
              )}
            </div>
          </div>
          <ClashBenchSidebar
            roundScores={roundScores}
            finalResult={finalResult}
            mode={mode}
            isStreaming={isStreaming}
          />
        </div>
      )}
    </div>
  );
}
