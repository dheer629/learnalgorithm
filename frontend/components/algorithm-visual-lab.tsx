"use client";

import {
  Activity,
  Braces,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  StepForward,
  Terminal
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { TraceStep, TraceValue, VisualizeResult } from "@/lib/types";

type VisualSample = {
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

export function AlgorithmVisualLab({ sourceCode, samples = [] }: { sourceCode: string; samples?: VisualSample[] }) {
  const firstSample = samples[0];
  const [selectedSample, setSelectedSample] = useState(firstSample ? "0" : "source");
  const [code, setCode] = useState(firstSample?.code ?? sourceCode);
  const [stdin, setStdin] = useState(firstSample?.stdin ?? "");
  const [maxSteps, setMaxSteps] = useState(140);
  const [speedMs, setSpeedMs] = useState(700);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<VisualizeResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeStep = result?.steps[activeIndex] ?? null;
  const total = result?.steps.length ?? 0;

  useEffect(() => {
    if (!playing || !total) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        if (current >= total - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speedMs);
    return () => window.clearInterval(timer);
  }, [playing, speedMs, total]);

  function loadSample(value: string) {
    setSelectedSample(value);
    setResult(null);
    setPlaying(false);
    setActiveIndex(0);
    setError(null);
    if (value === "source") {
      setCode(sourceCode);
      setStdin("");
      return;
    }
    const sample = samples[Number(value)];
    if (!sample) return;
    setCode(sample.code);
    setStdin(sample.stdin);
  }

  function runVisualization() {
    setError(null);
    setPlaying(false);
    startTransition(async () => {
      try {
        const nextResult = await api.visualize(code, stdin, maxSteps);
        setResult(nextResult);
        setActiveIndex(0);
      } catch (nextError) {
        setResult(null);
        setError(nextError instanceof Error ? nextError.message : "Visualization failed.");
      }
    });
  }

  function moveStep(delta: number) {
    if (!total) return;
    setActiveIndex((current) => Math.min(Math.max(current + delta, 0), total - 1));
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
      <Card className="grid content-start gap-4">
        <CardHeader className="mb-0">
          <div>
            <CardTitle>Visual Trace Studio</CardTitle>
            <CardDescription>{samples.length} validated runnable example{samples.length === 1 ? "" : "s"}</CardDescription>
          </div>
          <Badge tone={isPending ? "warning" : result?.status === "failed" ? "danger" : "muted"}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />}
            {isPending ? "tracing" : result?.status ?? "ready"}
          </Badge>
        </CardHeader>

        <label className="grid gap-2 text-sm font-semibold">
          Example
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={selectedSample}
            onChange={(event) => loadSample(event.target.value)}
          >
            {samples.map((sample, index) => (
              <option key={`${sample.title ?? "example"}-${index}`} value={String(index)}>
                {sample.title ?? `Example ${index + 1}`} {sample.matched === true ? "- matched" : ""}
              </option>
            ))}
            <option value="source">Source file</option>
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <RangeControl label="Trace depth" min={30} max={260} value={maxSteps} suffix="steps" onChange={setMaxSteps} />
          <RangeControl label="Speed" min={180} max={1400} value={speedMs} suffix="ms" onChange={setSpeedMs} />
        </div>

        <textarea
          aria-label="Trace standard input"
          className="min-h-20 resize-y rounded-md border border-border bg-background p-3 font-mono text-sm outline-none"
          placeholder="stdin"
          value={stdin}
          onChange={(event) => setStdin(event.target.value)}
        />

        <textarea
          aria-label="Trace source code"
          className="h-56 resize-y rounded-md border border-border bg-foreground p-4 font-mono text-sm leading-6 text-background outline-none"
          spellCheck={false}
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setSelectedSample("source");
            setResult(null);
            setPlaying(false);
            setError(null);
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={runVisualization} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            {isPending ? "Tracing" : "Visualize"}
          </Button>
          <Button variant="secondary" onClick={() => loadSample(firstSample ? "0" : "source")} disabled={isPending}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset
          </Button>
        </div>

        {error && <div className="rounded-md border border-accent/60 bg-accent/10 p-3 text-sm text-accent">{error}</div>}
      </Card>

      <div className="grid gap-4">
        <TracePlayback
          activeIndex={activeIndex}
          result={result}
          step={activeStep}
          playing={playing}
          onMove={moveStep}
          onPlay={() => setPlaying((value) => !value)}
          onSeek={setActiveIndex}
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <VariableBoard step={activeStep} />
          <OutputAndLogs result={result} step={activeStep} />
        </div>
      </div>
    </section>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  suffix,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      <span className="flex items-center justify-between gap-3">
        {label}
        <span className="text-xs text-foreground/60">
          {value} {suffix}
        </span>
      </span>
      <input
        aria-label={label}
        className="h-10 accent-primary"
        max={max}
        min={min}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function TracePlayback({
  activeIndex,
  result,
  step,
  playing,
  onMove,
  onPlay,
  onSeek
}: {
  activeIndex: number;
  result: VisualizeResult | null;
  step: TraceStep | null;
  playing: boolean;
  onMove: (delta: number) => void;
  onPlay: () => void;
  onSeek: (index: number) => void;
}) {
  const total = result?.steps.length ?? 0;
  const visibleSteps = useMemo(() => {
    if (!result?.steps.length) return [];
    const start = Math.max(0, activeIndex - 6);
    return result.steps.slice(start, start + 13);
  }, [activeIndex, result]);

  return (
    <Card className="grid gap-4">
      <CardHeader className="mb-0">
        <div>
          <CardTitle>Trace Playback</CardTitle>
          <CardDescription>
            {step?.line_no ? `Line ${step.line_no}` : "Ready"} {step ? `in ${step.function}` : ""}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button className="h-9 w-9 px-0" variant="secondary" onClick={() => onMove(-1)} disabled={!total || activeIndex === 0}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button className="h-9 w-9 px-0" variant="secondary" onClick={onPlay} disabled={!total}>
            {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          </Button>
          <Button className="h-9 w-9 px-0" variant="secondary" onClick={() => onMove(1)} disabled={!total || activeIndex === total - 1}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardHeader>

      <input
        aria-label="Trace step"
        className="w-full accent-primary"
        disabled={!total}
        max={Math.max(total - 1, 0)}
        min="0"
        type="range"
        value={activeIndex}
        onChange={(event) => onSeek(Number(event.target.value))}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="bg-foreground text-background">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-background/70">
            <Terminal className="h-3.5 w-3.5" aria-hidden />
            Current line
          </div>
          <code className="block min-h-16 whitespace-pre-wrap break-words text-sm">
            {step?.line_text?.trim() || "Press Visualize to capture execution steps."}
          </code>
        </Card>
        <Card className="bg-muted/60">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/60">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Explain this step
          </div>
          <p className="min-h-16 text-sm leading-6">{step?.narration ?? "Deterministic narration appears here after tracing."}</p>
        </Card>
      </div>

      <div className="grid gap-2 overflow-auto pb-1">
        <div className="flex min-w-full gap-2">
          {visibleSteps.length ? (
            visibleSteps.map((item) => (
              <button
                className={`grid min-w-36 gap-1 rounded-md border px-3 py-2 text-left text-sm transition ${
                  item.index - 1 === activeIndex ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted"
                }`}
                key={`${item.index}-${item.line_no}-${item.event}`}
                onClick={() => onSeek(item.index - 1)}
                type="button"
              >
                <span className="flex items-center justify-between gap-2 font-semibold">
                  #{item.index}
                  <StepForward className="h-3.5 w-3.5 text-primary" aria-hidden />
                </span>
                <span className="truncate font-mono text-xs">{item.line_text.trim() || item.event}</span>
                <span className="text-xs uppercase text-foreground/60">{item.event}</span>
              </button>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-foreground/60">No trace frames captured yet.</div>
          )}
        </div>
      </div>
    </Card>
  );
}

function VariableBoard({ step }: { step: TraceStep | null }) {
  const locals = step?.locals ?? [];
  const arrays = locals.filter((local) => local.numeric_items.length > 0);

  return (
    <Card className="grid gap-4">
      <CardHeader className="mb-0">
        <div>
          <CardTitle>Variable Inspector</CardTitle>
          <CardDescription>{locals.length} visible value{locals.length === 1 ? "" : "s"}</CardDescription>
        </div>
        <Gauge className="h-5 w-5 text-primary" aria-hidden />
      </CardHeader>

      {arrays.length > 0 && (
        <div className="grid gap-3">
          {arrays.slice(0, 3).map((array) => (
            <ArrayBars key={`${array.name}-${array.preview}`} value={array} />
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {locals.length ? (
          locals.map((local) => <ValueTile key={`${local.name}-${local.kind}-${local.preview}`} value={local} />)
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-foreground/60">Trace a run to populate live variables.</div>
        )}
      </div>
    </Card>
  );
}

function ArrayBars({ value }: { value: TraceValue }) {
  const numbers = value.numeric_items.slice(0, 24);
  const max = Math.max(...numbers.map((number) => Math.abs(number)), 1);
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">{value.name}</span>
        <span className="text-xs text-foreground/60">{value.size ?? numbers.length} item{value.size === 1 ? "" : "s"}</span>
      </div>
      <div className="flex h-36 items-end gap-1 overflow-hidden">
        {numbers.map((number, index) => (
          <div className="flex min-w-5 flex-1 flex-col items-center gap-1" key={`${value.name}-${index}-${number}`}>
            <div
              className="w-full rounded-t-sm bg-primary/85 shadow-sm transition-all"
              style={{ height: `${Math.max(10, (Math.abs(number) / max) * 120)}px` }}
            />
            <span className="max-w-full truncate text-[10px] text-foreground/60">{formatNumber(number)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueTile({ value }: { value: TraceValue }) {
  const icon = value.kind === "dict" ? <Braces className="h-4 w-4" aria-hidden /> : <Activity className="h-4 w-4" aria-hidden />;
  return (
    <div className="grid gap-2 rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          {icon}
          <span className="truncate">{value.name}</span>
        </span>
        <Badge tone="muted">{value.kind}</Badge>
      </div>
      <code className="block min-h-10 overflow-hidden break-words text-xs text-foreground/75">{value.preview}</code>
      {value.items.length > 0 && (
        <div className="grid gap-1 border-t border-border pt-2 text-xs">
          {value.items.slice(0, 4).map((item, index) => (
            <span className="truncate text-foreground/65" key={`${value.name}-item-${index}`}>
              {formatTraceItem(item)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function OutputAndLogs({ result, step }: { result: VisualizeResult | null; step: TraceStep | null }) {
  const logs = result?.logs?.length ? result.logs : ["No trace logs yet."];
  return (
    <div className="grid gap-4">
      <Card className="grid gap-3">
        <CardHeader className="mb-0">
          <CardTitle>stdout / stderr</CardTitle>
          <Badge tone={result?.status === "failed" ? "danger" : "muted"}>{result?.status ?? "ready"}</Badge>
        </CardHeader>
        <pre className="max-h-44 min-h-28 overflow-auto rounded-md border border-border bg-foreground p-3 text-sm text-background">
          {step?.stdout || result?.stdout || "stdout will appear here."}
        </pre>
        <pre className="max-h-44 min-h-20 overflow-auto rounded-md border border-border bg-background p-3 text-sm text-accent">
          {step?.stderr || result?.stderr || "stderr will appear here."}
        </pre>
      </Card>
      <Card className="grid gap-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-primary" aria-hidden />
          Logs
        </div>
        <div className="grid max-h-56 gap-2 overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs">
          {logs.map((line, index) => (
            <span className="break-words font-mono" key={`${index}-${line}`}>
              {line}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatTraceItem(item: Record<string, unknown>) {
  const keyed = item as { key?: unknown; value?: { preview?: unknown } };
  if (keyed.key !== undefined) {
    return `${String(keyed.key)}: ${String(keyed.value?.preview ?? "")}`;
  }
  const named = item as { name?: unknown; preview?: unknown };
  return `${String(named.name ?? "")}: ${String(named.preview ?? "")}`;
}
