"use client";

import { CheckCircle2, Play, RotateCcw, TestTube2, Type, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { api } from "@/lib/api";
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
};

export function CodeRunner({ sourceCode, sample, samples = [] }: { sourceCode: string; sample?: SampleRun | null; samples?: SampleRun[] }) {
  const availableSamples = samples.length > 0 ? samples : sample ? [sample] : [];
  const [code, setCode] = useState(sourceCode);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState(availableSamples[0]?.actualOutput || "Run the algorithm to see output here.");
  const [expectedOutput, setExpectedOutput] = useState(availableSamples[0]?.expectedOutput ?? "");
  const [matchState, setMatchState] = useState<"idle" | "matched" | "not-matched">("idle");
  const [isPending, startTransition] = useTransition();
  const { codeFontSize, setCodeFontSize } = usePreferences();

  function loadSample(nextSample: SampleRun) {
    setCode(nextSample.code);
    setStdin(nextSample.stdin);
    setExpectedOutput(nextSample.expectedOutput);
    setOutput(nextSample.actualOutput || "Sample loaded. Press Run to compare actual output with expected output.");
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
        setMatchState(compareOutput(actual, expectedOutput));
      } catch (error) {
        setOutput(error instanceof Error ? error.message : "Execution failed.");
        setMatchState("not-matched");
      }
    });
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="border border-border bg-muted/50">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Editable Python</span>
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
          className="h-[480px] w-full resize-none bg-transparent p-4 font-mono leading-6 outline-none"
          style={{ fontSize: codeFontSize }}
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </div>
      <aside className="grid gap-3 content-start">
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
        <pre className="min-h-56 overflow-auto border border-border bg-foreground p-3 text-sm text-background">
          {output}
        </pre>
      </aside>
    </section>
  );
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
