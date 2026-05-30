"use client";

import {
  Activity,
  CheckCircle2,
  Clock3,
  Cpu,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
  TestTube2,
  Type,
  XCircle
} from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ExecuteResult } from "@/lib/types";
import { usePreferences } from "@/store/preferences";

type SampleRun = {
  title?: string;
  command?: string;
  code: string;
  stdin: string;
  expectedOutput: string;
  actualOutput?: string;
  matched?: boolean | null;
  status?: string;
  validationError?: string | null;
  executionTimeMs?: number | null;
  runner?: string | null;
  pythonVersion?: string | null;
  exitCode?: number | null;
  logs?: string[];
};

type RunState = "idle" | "loading-sample" | "running" | "completed" | "failed";

export function CodeRunner({
  sourceCode,
  sample,
  samples = []
}: {
  sourceCode: string;
  sample?: SampleRun | null;
  samples?: SampleRun[];
}) {
  const availableSamples = samples.length > 0 ? samples : sample ? [sample] : [];
  const firstSample = availableSamples[0];
  const [code, setCode] = useState(sourceCode);
  const [stdin, setStdin] = useState("");
  const [actualOutput, setActualOutput] = useState(firstSample?.actualOutput || "Run the algorithm to see output here.");
  const [expectedOutput, setExpectedOutput] = useState(firstSample?.expectedOutput ?? "");
  const [matchState, setMatchState] = useState<"idle" | "matched" | "not-matched">(
    firstSample?.matched === true ? "matched" : firstSample?.matched === false ? "not-matched" : "idle"
  );
  const [runState, setRunState] = useState<RunState>(firstSample ? "completed" : "idle");
  const [selectedExample, setSelectedExample] = useState(firstSample?.title ?? "Custom run");
  const [runMeta, setRunMeta] = useState<ExecuteResult | null>(firstSample ? sampleToResult(firstSample) : null);
  const [isPending, startTransition] = useTransition();
  const { codeFontSize, setCodeFontSize } = usePreferences();

  function loadSample(nextSample: SampleRun) {
    setRunState("loading-sample");
    setSelectedExample(nextSample.title ?? "Example");
    setCode(nextSample.code);
    setStdin(nextSample.stdin);
    setExpectedOutput(nextSample.expectedOutput);
    setActualOutput(nextSample.actualOutput || "Sample loaded. Press Run to execute it in the backend Python runtime.");
    setRunMeta(sampleToResult(nextSample));
    setMatchState(nextSample.matched === true ? "matched" : nextSample.matched === false ? "not-matched" : "idle");
    window.setTimeout(() => setRunState(nextSample.actualOutput ? "completed" : "idle"), 250);
  }

  function loadAndRunSample(nextSample: SampleRun) {
    loadSample(nextSample);
    runCode(nextSample.code, nextSample.stdin, nextSample.expectedOutput, nextSample.title ?? "Example");
  }

  function runCode(nextCode = code, nextStdin = stdin, nextExpected = expectedOutput, title = selectedExample) {
    setRunState("running");
    setSelectedExample(title);
    startTransition(async () => {
      try {
        const result = await api.execute(nextCode, nextStdin);
        const actual = result.output || result.stdout || result.stderr || "Execution finished without output.";
        setActualOutput(actual);
        setRunMeta(result);
        setMatchState(compareOutput(actual, nextExpected));
        setRunState(result.status === "failed" || result.status === "timeout" ? "failed" : "completed");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Execution failed.";
        setActualOutput(message);
        setRunMeta({
          stdout: "",
          stderr: message,
          output: message,
          execution_time_ms: null,
          status: "failed",
          runner: "api",
          python_version: null,
          exit_code: null,
          logs: [message]
        });
        setMatchState("not-matched");
        setRunState("failed");
      }
    });
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)]">
      <div className="glass-panel overflow-hidden border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center bg-primary text-white">
              <Terminal className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Python Editor</h3>
              <p className="text-xs text-foreground/60">Runs on the backend Python environment</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Type className="h-4 w-4" aria-hidden />
            <input
              aria-label="Code font size"
              className="w-24 accent-primary"
              type="range"
              min="12"
              max="20"
              value={codeFontSize}
              onChange={(event) => setCodeFontSize(Number(event.target.value))}
            />
          </label>
        </div>
        <textarea
          aria-label="Algorithm source code"
          className="h-[690px] w-full resize-none bg-transparent p-5 font-mono leading-6 outline-none"
          style={{ fontSize: codeFontSize }}
          spellCheck={false}
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setSelectedExample("Custom run");
            setRunState("idle");
          }}
        />
      </div>

      <aside className="grid content-start gap-4">
        <div className="glass-panel grid gap-3 border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Execution Cockpit</h3>
              <p className="text-xs text-foreground/60">{selectedExample}</p>
            </div>
            <RunBadge state={runState} pending={isPending} />
          </div>
          <RuntimePanel result={runMeta} />
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <textarea
              aria-label="Standard input"
              className="min-h-24 w-full resize-y border border-border bg-background p-3 font-mono text-sm"
              placeholder="stdin"
              value={stdin}
              onChange={(event) => setStdin(event.target.value)}
            />
            <div className="grid gap-2 md:w-40">
              <Button onClick={() => runCode()} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                {isPending ? "Running" : "Run"}
              </Button>
              {firstSample && (
                <Button variant="secondary" onClick={() => loadSample(firstSample)} disabled={isPending}>
                  <TestTube2 className="h-4 w-4" aria-hidden />
                  Load
                </Button>
              )}
            </div>
          </div>
        </div>

        {availableSamples.length > 0 && (
          <div className="glass-panel grid gap-3 border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Validated Examples</h3>
              <span className="text-xs text-foreground/60">{availableSamples.length} available</span>
            </div>
            <div className="grid max-h-72 gap-2 overflow-auto">
              {availableSamples.map((item, index) => (
                <div key={`${item.title ?? "example"}-${index}`} className="grid gap-2 border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <button className="text-left text-sm font-semibold hover:text-primary" type="button" onClick={() => loadSample(item)}>
                      {item.title ?? `Example ${index + 1}`}
                    </button>
                    <StatusBadge matched={item.matched} status={item.status} />
                  </div>
                  {item.command && <code className="break-all text-xs text-foreground/70">{item.command}</code>}
                  {item.validationError && <span className="text-xs text-accent">{item.validationError}</span>}
                  <div className="flex gap-2">
                    <Button className="h-8 px-3" variant="secondary" onClick={() => loadSample(item)} disabled={isPending}>
                      Load
                    </Button>
                    <Button className="h-8 px-3" onClick={() => loadAndRunSample(item)} disabled={isPending}>
                      Run sample
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <OutputBox title="Expected output" value={expectedOutput || "No expected output is annotated for this run."} tone="expected" />
          <OutputBox title="Actual output" value={actualOutput} tone="actual" />
        </div>

        <div className="glass-panel flex items-center gap-2 border border-border p-3 text-sm">
          {matchState === "matched" && <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />}
          {matchState === "not-matched" && <XCircle className="h-4 w-4 text-accent" aria-hidden />}
          {matchState === "idle" && <RotateCcw className="h-4 w-4 text-foreground/60" aria-hidden />}
          <span>
            {matchState === "matched" && "Matched: actual output equals expected output."}
            {matchState === "not-matched" && "Not matched: inspect stdout, stderr, and logs below."}
            {matchState === "idle" && "Run code to check whether actual output matches expected output."}
          </span>
        </div>

        <ExecutionLogs result={runMeta} />
      </aside>
    </section>
  );
}

function RunBadge({ state, pending }: { state: RunState; pending: boolean }) {
  const label = pending || state === "running" ? "running" : state.replace("-", " ");
  return (
    <span className="inline-flex items-center gap-2 border border-border bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide">
      {pending || state === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Cpu className="h-3.5 w-3.5" aria-hidden />}
      {label}
    </span>
  );
}

function RuntimePanel({ result }: { result: ExecuteResult | null }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
      <Metric label="Runner" value={result?.runner ?? "local-python"} />
      <Metric label="Python" value={result?.python_version ?? "backend"} />
      <Metric label="Exit code" value={result?.exit_code === null || result?.exit_code === undefined ? "pending" : String(result.exit_code)} />
      <Metric label="Time" value={result?.execution_time_ms ? `${result.execution_time_ms} ms` : "pending"} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border border-border bg-background p-2">
      <span className="text-foreground/60">{label}</span>
      <span className="truncate font-semibold">{value}</span>
    </div>
  );
}

function OutputBox({ title, value, tone }: { title: string; value: string; tone: "expected" | "actual" }) {
  return (
    <div className="glass-panel grid gap-2 border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className={tone === "actual" ? "text-xs font-medium text-primary" : "text-xs font-medium text-foreground/60"}>
          {tone}
        </span>
      </div>
      <pre className="min-h-48 overflow-auto border border-border bg-foreground p-3 text-sm text-background">{value}</pre>
    </div>
  );
}

function ExecutionLogs({ result }: { result: ExecuteResult | null }) {
  const logs = result?.logs?.length ? result.logs : ["No run logs yet. Press Run to execute the code in the backend Python environment."];
  return (
    <div className="glass-panel grid gap-3 border border-border p-4">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Activity className="h-4 w-4 text-primary" aria-hidden />
        Execution logs and failure reason
      </span>
      <div className="grid max-h-64 gap-2 overflow-auto border border-border bg-muted/50 p-3 text-xs">
        {logs.map((line, index) => (
          <div key={`${index}-${line}`} className="flex gap-2">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/50" aria-hidden />
            <span className="break-words font-mono">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function sampleToResult(sample: SampleRun): ExecuteResult {
  return {
    stdout: sample.actualOutput ?? "",
    stderr: sample.validationError ?? "",
    output: sample.actualOutput ?? sample.validationError ?? "",
    execution_time_ms: sample.executionTimeMs ?? null,
    status: sample.status ?? "validated",
    runner: sample.runner ?? "local-python",
    python_version: sample.pythonVersion ?? null,
    exit_code: sample.exitCode ?? null,
    logs: sample.logs ?? []
  };
}

function StatusBadge({ matched, status }: { matched?: boolean | null; status?: string }) {
  if (matched === true) return <span className="text-xs font-semibold text-primary">matched</span>;
  if (matched === false) return <span className="text-xs font-semibold text-accent">not matched</span>;
  return <span className="text-xs font-semibold text-foreground/60">{status ?? "ready"}</span>;
}

function compareOutput(actual: string, expected: string): "idle" | "matched" | "not-matched" {
  if (!expected.trim()) return "idle";
  return normalize(actual) === normalize(expected) ? "matched" : "not-matched";
}

function normalize(value: string) {
  return value.replace(/\r/g, "").trim();
}
