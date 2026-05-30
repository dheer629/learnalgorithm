"use client";

import {
  CheckCircle2,
  Clipboard,
  Clock3,
  Code2,
  Copy,
  Download,
  Loader2,
  Play,
  RotateCcw,
  Rows3,
  Terminal,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import type React from "react";
import { CodeEditor } from "@/components/code-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type RunState = "idle" | "running" | "completed" | "failed";

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
  const [code, setCode] = useState(firstSample?.code ?? sourceCode);
  const [stdin, setStdin] = useState(firstSample?.stdin ?? "");
  const [actualOutput, setActualOutput] = useState(firstSample?.actualOutput || "Run the algorithm to see output here.");
  const [expectedOutput, setExpectedOutput] = useState(firstSample?.expectedOutput ?? "");
  const [selectedExample, setSelectedExample] = useState(firstSample?.title ?? "Custom run");
  const [runMeta, setRunMeta] = useState<ExecuteResult | null>(firstSample ? sampleToResult(firstSample) : null);
  const [runState, setRunState] = useState<RunState>(firstSample ? "completed" : "idle");
  const [logsOpen, setLogsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { codeFontSize, setCodeFontSize } = usePreferences();
  const matchState = compareOutput(actualOutput, expectedOutput);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        runCode();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function loadSample(nextSample: SampleRun) {
    setSelectedExample(nextSample.title ?? "Example");
    setCode(nextSample.code);
    setStdin(nextSample.stdin);
    setExpectedOutput(nextSample.expectedOutput);
    setActualOutput(nextSample.actualOutput || "Sample loaded. Press Run to execute it.");
    setRunMeta(sampleToResult(nextSample));
    setRunState(nextSample.actualOutput ? "completed" : "idle");
  }

  function resetCode() {
    if (firstSample) {
      loadSample(firstSample);
      return;
    }
    setCode(sourceCode);
    setStdin("");
    setExpectedOutput("");
    setActualOutput("Run the algorithm to see output here.");
    setRunMeta(null);
    setRunState("idle");
    setSelectedExample("Custom run");
  }

  function runCode(nextCode = code, nextStdin = stdin, nextExpected = expectedOutput, title = selectedExample) {
    setRunState("running");
    setSelectedExample(title);
    startTransition(async () => {
      try {
        const result = await api.execute(nextCode, nextStdin);
        const actual = result.output || result.stdout || result.stderr || "Execution finished without output.";
        setActualOutput(actual);
        setExpectedOutput(nextExpected);
        setRunMeta(result);
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
        setRunState("failed");
      }
    });
  }

  const diff = useMemo(() => buildDiff(expectedOutput, actualOutput), [actualOutput, expectedOutput]);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary text-white">
              <Terminal className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-semibold">Python Editor</h3>
              <p className="text-xs text-foreground/60">{selectedExample}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Code2 className="h-4 w-4" aria-hidden />
              <input
                aria-label="Code font size"
                className="w-24 accent-primary"
                max="20"
                min="12"
                type="range"
                value={codeFontSize}
                onChange={(event) => setCodeFontSize(Number(event.target.value))}
              />
            </label>
            <IconButton label="Copy code" onClick={() => copyText(code)}>
              <Copy className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton label="Download code" onClick={() => downloadCode(code, selectedExample)}>
              <Download className="h-4 w-4" aria-hidden />
            </IconButton>
          </div>
        </div>
        <CodeEditor
          value={code}
          fontSize={codeFontSize}
          height={680}
          onChange={(nextCode) => {
            setCode(nextCode);
            setSelectedExample("Custom run");
            setRunState("idle");
          }}
        />
      </Card>

      <aside className="grid content-start gap-4">
        <Card className="grid gap-4">
          <CardHeader className="mb-0">
            <div>
              <CardTitle>Execution Cockpit</CardTitle>
              <CardDescription>Runs with the backend Python sandbox. Use Ctrl/Cmd + Enter to run.</CardDescription>
            </div>
            <RunBadge state={runState} pending={isPending} />
          </CardHeader>
          <RuntimePanel result={runMeta} />
          <textarea
            aria-label="Standard input"
            className="min-h-24 w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-sm"
            placeholder="stdin"
            value={stdin}
            onChange={(event) => setStdin(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runCode()} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {isPending ? "Running" : "Run"}
            </Button>
            <Button variant="secondary" onClick={resetCode} disabled={isPending}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </Button>
            <Button variant="secondary" onClick={() => setCode(tidyPython(code))} disabled={isPending}>
              <Rows3 className="h-4 w-4" aria-hidden />
              Tidy
            </Button>
          </div>
        </Card>

        {availableSamples.length > 0 && (
          <Card className="grid gap-3">
            <CardHeader className="mb-0">
              <CardTitle>Runnable Examples</CardTitle>
              <Badge tone="muted">{availableSamples.length} available</Badge>
            </CardHeader>
            <div className="grid max-h-72 gap-2 overflow-auto">
              {availableSamples.map((item, index) => (
                <button
                  className="grid gap-2 rounded-md border border-border bg-background p-3 text-left hover:bg-muted"
                  key={`${item.title ?? "example"}-${index}`}
                  type="button"
                  onClick={() => loadSample(item)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{item.title ?? `Example ${index + 1}`}</span>
                    <StatusBadge matched={item.matched} status={item.status} />
                  </span>
                  {item.command && <code className="break-all text-xs text-foreground/70">{item.command}</code>}
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card className="grid gap-3">
          <CardHeader className="mb-0">
            <CardTitle>Expected vs Actual</CardTitle>
            <MatchBadge state={matchState} />
          </CardHeader>
          <div className="grid gap-3 lg:grid-cols-2">
            <OutputBox title="Expected" value={expectedOutput || "No expected output is annotated."} onCopy={() => copyText(expectedOutput)} />
            <OutputBox title="Actual" value={actualOutput} onCopy={() => copyText(actualOutput)} />
          </div>
          <DiffView rows={diff} />
        </Card>

        <Card className="grid gap-3">
          <button
            className="flex items-center justify-between gap-3 text-left font-semibold"
            type="button"
            onClick={() => setLogsOpen((value) => !value)}
          >
            <span className="flex items-center gap-2">
              <Clipboard className="h-4 w-4 text-primary" aria-hidden />
              Execution logs
            </span>
            <Badge tone="muted">{logsOpen ? "open" : "closed"}</Badge>
          </button>
          {logsOpen && <ExecutionLogs result={runMeta} />}
        </Card>
      </aside>
    </section>
  );
}

function RunBadge({ state, pending }: { state: RunState; pending: boolean }) {
  if (pending || state === "running") {
    return (
      <Badge tone="warning">
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
        running
      </Badge>
    );
  }
  return <Badge tone={state === "failed" ? "danger" : state === "completed" ? "success" : "muted"}>{state}</Badge>;
}

function RuntimePanel({ result }: { result: ExecuteResult | null }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
      <Metric label="Runner" value={result?.runner ?? "pending"} />
      <Metric label="Python" value={result?.python_version ?? "pending"} />
      <Metric label="Exit" value={result?.exit_code === null || result?.exit_code === undefined ? "pending" : String(result.exit_code)} />
      <Metric label="Time" value={result?.execution_time_ms ? `${result.execution_time_ms} ms` : "pending"} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border border-border bg-background p-2">
      <span className="text-foreground/60">{label}</span>
      <span className="truncate font-semibold">{value}</span>
    </div>
  );
}

function OutputBox({ title, value, onCopy }: { title: string; value: string; onCopy: () => void }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <IconButton label={`Copy ${title.toLowerCase()} output`} onClick={onCopy}>
          <Copy className="h-4 w-4" aria-hidden />
        </IconButton>
      </div>
      <pre className="min-h-40 overflow-auto rounded-md border border-border bg-foreground p-3 text-sm text-background">{value}</pre>
    </div>
  );
}

function DiffView({ rows }: { rows: Array<{ expected: string; actual: string; same: boolean }> }) {
  if (!rows.length) return null;
  return (
    <div className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs">
      {rows.map((row, index) => (
        <div className="grid gap-2 md:grid-cols-[1fr_1fr]" key={`${index}-${row.expected}-${row.actual}`}>
          <code className={row.same ? "text-foreground/70" : "text-accent"}>{row.expected || " "}</code>
          <code className={row.same ? "text-foreground/70" : "text-accent"}>{row.actual || " "}</code>
        </div>
      ))}
    </div>
  );
}

function ExecutionLogs({ result }: { result: ExecuteResult | null }) {
  const logs = result?.logs?.length ? result.logs : ["No run logs yet."];
  return (
    <div className="grid max-h-64 gap-2 overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs">
      {logs.map((line, index) => (
        <div key={`${index}-${line}`} className="flex gap-2">
          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/50" aria-hidden />
          <span className="break-words font-mono">{line}</span>
        </div>
      ))}
    </div>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="inline-grid h-9 w-9 place-items-center rounded-md border border-border bg-background hover:bg-muted"
      type="button"
      onClick={onClick}
      title={label}
    >
      {children}
    </button>
  );
}

function MatchBadge({ state }: { state: "idle" | "matched" | "not-matched" }) {
  if (state === "matched") {
    return (
      <Badge tone="success">
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden />
        matched
      </Badge>
    );
  }
  if (state === "not-matched") {
    return (
      <Badge tone="danger">
        <XCircle className="mr-1 h-3.5 w-3.5" aria-hidden />
        diff
      </Badge>
    );
  }
  return <Badge tone="muted">ready</Badge>;
}

function StatusBadge({ matched, status }: { matched?: boolean | null; status?: string }) {
  if (matched === true) return <Badge tone="success">matched</Badge>;
  if (matched === false) return <Badge tone="danger">not matched</Badge>;
  return <Badge tone="muted">{status ?? "ready"}</Badge>;
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

function compareOutput(actual: string, expected: string): "idle" | "matched" | "not-matched" {
  if (!expected.trim()) return "idle";
  return normalize(actual) === normalize(expected) ? "matched" : "not-matched";
}

function buildDiff(expected: string, actual: string) {
  if (!expected.trim()) return [];
  const expectedLines = normalize(expected).split("\n");
  const actualLines = normalize(actual).split("\n");
  const total = Math.max(expectedLines.length, actualLines.length);
  return Array.from({ length: total }).map((_, index) => ({
    expected: expectedLines[index] ?? "",
    actual: actualLines[index] ?? "",
    same: (expectedLines[index] ?? "") === (actualLines[index] ?? "")
  }));
}

function normalize(value: string) {
  return value.replace(/\r/g, "").trim();
}

function tidyPython(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trimEnd()
    .concat("\n");
}

async function copyText(value: string) {
  await navigator.clipboard?.writeText(value);
}

function downloadCode(value: string, title: string) {
  const blob = new Blob([value], { type: "text/x-python" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "algorithm"}.py`;
  link.click();
  URL.revokeObjectURL(url);
}
