"use client";

import { Activity, CheckCircle2, Clock3, Play, RotateCcw, Server, Terminal, TestTube2, Type, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { api } from "@/lib/api";
import type { ExecuteResult } from "@/lib/types";
import { usePreferences } from "@/store/preferences";
import { Button } from "@/components/ui/button";

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

export function CodeRunner({ sourceCode, sample, samples = [] }: { sourceCode: string; sample?: SampleRun | null; samples?: SampleRun[] }) {
  const availableSamples = samples.length > 0 ? samples : sample ? [sample] : [];
  const [code, setCode] = useState(sourceCode);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState(availableSamples[0]?.actualOutput || "Run the algorithm to see output here.");
  const [expectedOutput, setExpectedOutput] = useState(availableSamples[0]?.expectedOutput ?? "");
  const [matchState, setMatchState] = useState<"idle" | "matched" | "not-matched">("idle");
  const [runMeta, setRunMeta] = useState<ExecuteResult | null>(
    availableSamples[0]
      ? sampleToResult(availableSamples[0])
      : null
  );
  const [isPending, startTransition] = useTransition();
  const { codeFontSize, setCodeFontSize } = usePreferences();

  function loadSample(nextSample: SampleRun) {
    setCode(nextSample.code);
    setStdin(nextSample.stdin);
    setExpectedOutput(nextSample.expectedOutput);
    setOutput(nextSample.actualOutput || "Sample loaded. Press Run to compare actual output with expected output.");
    setRunMeta(sampleToResult(nextSample));
    if (nextSample.matched === true) setMatchState("matched");
    else if (nextSample.matched === false) setMatchState("not-matched");
    else setMatchState("idle");
  }

  function run() {
    startTransition(async () => {
      try {
        const result = await api.execute(code, stdin);
        const actual = result.output || result.stdout || result.stderr || "Execution finished without output.";
        setOutput(actual);
        setRunMeta(result);
        setMatchState(compareOutput(actual, expectedOutput));
      } catch (error) {
        setOutput(error instanceof Error ? error.message : "Execution failed.");
        setRunMeta({
          stdout: "",
          stderr: error instanceof Error ? error.message : "Execution failed.",
          output: error instanceof Error ? error.message : "Execution failed.",
          execution_time_ms: null,
          status: "failed",
          runner: "api",
          python_version: null,
          exit_code: null,
          logs: [error instanceof Error ? error.message : "Execution failed before the backend returned details."]
        });
        setMatchState("not-matched");
      }
    });
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <div className="border border-border bg-background shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Terminal className="h-4 w-4 text-primary" aria-hidden />
            Python Workspace
          </span>
          <label className="flex items-center gap-2 text-sm">
            <Type className="h-4 w-4" aria-hidden />
            <input
              aria-label="Code font size"
              className="w-20 accent-primary"
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
          className="h-[620px] w-full resize-none bg-transparent p-4 font-mono leading-6 outline-none"
          style={{ fontSize: codeFontSize }}
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </div>
      <aside className="grid content-start gap-3">
        <RuntimePanel result={runMeta} />
        <textarea
          aria-label="Standard input"
          className="min-h-28 w-full border border-border bg-background p-3 font-mono text-sm"
          placeholder="stdin"
          value={stdin}
          onChange={(event) => setStdin(event.target.value)}
        />
        <Button onClick={run} disabled={isPending}>
          <Play className="h-4 w-4" aria-hidden />
          {isPending ? "Running" : "Run"}
        </Button>
        {availableSamples[0] && (
          <Button variant="secondary" onClick={() => loadSample(availableSamples[0])} disabled={isPending}>
            <TestTube2 className="h-4 w-4" aria-hidden />
            Load sample
          </Button>
        )}
        {availableSamples.length > 0 && (
          <div className="grid gap-2 border border-border p-3">
            <span className="text-sm font-semibold">Validated examples</span>
            <div className="grid gap-2">
              {availableSamples.map((item, index) => (
                <button
                  key={`${item.title ?? "example"}-${index}`}
                  type="button"
                  className="grid gap-1 border border-border p-3 text-left text-sm transition-colors hover:bg-muted"
                  onClick={() => loadSample(item)}
                >
                  <span className="flex items-center justify-between gap-2 font-medium">
                    <span>{item.title ?? `Example ${index + 1}`}</span>
                    <StatusBadge matched={item.matched} status={item.status} />
                  </span>
                  {item.command && <code className="break-all text-xs text-foreground/70">{item.command}</code>}
                  {item.validationError && <span className="text-xs text-accent">{item.validationError}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="expected-output">
            Expected output
          </label>
          <textarea
            id="expected-output"
            className="min-h-24 w-full resize-y border border-border bg-background p-3 font-mono text-sm"
            placeholder="Optional expected output"
            value={expectedOutput}
            onChange={(event) => {
              setExpectedOutput(event.target.value);
              setMatchState("idle");
            }}
          />
        </div>
        <div className="flex items-center gap-2 border border-border p-3 text-sm">
          {matchState === "matched" && <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />}
          {matchState === "not-matched" && <XCircle className="h-4 w-4 text-accent" aria-hidden />}
          {matchState === "idle" && <RotateCcw className="h-4 w-4 text-foreground/60" aria-hidden />}
          <span>
            {matchState === "matched" && "Matched: actual output equals expected output."}
            {matchState === "not-matched" && "Not matched: compare actual output with expected output."}
            {matchState === "idle" && "Run code to check whether actual output matches expected output."}
          </span>
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium">Actual output</span>
          <pre className="min-h-44 overflow-auto border border-border bg-foreground p-3 text-sm text-background">
          {output}
          </pre>
        </div>
        <ExecutionLogs result={runMeta} />
      </aside>
    </section>
  );
}

function RuntimePanel({ result }: { result: ExecuteResult | null }) {
  return (
    <div className="grid gap-3 border border-border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Server className="h-4 w-4 text-primary" aria-hidden />
        Python Runtime
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="Runner" value={result?.runner ?? "local-python"} />
        <Metric label="Python" value={result?.python_version ?? "backend"} />
        <Metric label="Exit code" value={result?.exit_code === null || result?.exit_code === undefined ? "pending" : String(result.exit_code)} />
        <Metric label="Time" value={result?.execution_time_ms ? `${result.execution_time_ms} ms` : "pending"} />
      </div>
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

function ExecutionLogs({ result }: { result: ExecuteResult | null }) {
  const logs = result?.logs?.length ? result.logs : ["No run logs yet. Press Run to execute the code in the backend Python environment."];
  return (
    <div className="grid gap-2">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Activity className="h-4 w-4 text-primary" aria-hidden />
        Execution logs
      </span>
      <div className="grid max-h-56 gap-2 overflow-auto border border-border bg-muted/50 p-3 text-xs">
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
