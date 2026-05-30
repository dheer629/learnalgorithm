"use client";

import {
  Activity,
  Box,
  Braces,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Gauge,
  Layers3,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Terminal
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
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

export function AlgorithmVisualLab({
  sourceCode,
  samples = []
}: {
  sourceCode: string;
  samples?: VisualSample[];
}) {
  const firstSample = samples[0];
  const [selectedSample, setSelectedSample] = useState(firstSample ? "0" : "source");
  const [code, setCode] = useState(firstSample?.code ?? sourceCode);
  const [stdin, setStdin] = useState(firstSample?.stdin ?? "");
  const [maxSteps, setMaxSteps] = useState(140);
  const [result, setResult] = useState<VisualizeResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeStep = result?.steps[activeIndex] ?? null;
  const runnableCount = samples.length;

  function loadSample(value: string) {
    setSelectedSample(value);
    setResult(null);
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
    if (!result?.steps.length) return;
    setActiveIndex((current) => Math.min(Math.max(current + delta, 0), result.steps.length - 1));
  }

  const currentLine = activeStep?.line_no ? `Line ${activeStep.line_no}` : "Ready";
  const status = isPending ? "tracing" : result?.status ?? "ready";

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(360px,0.82fr)_minmax(0,1.18fr)]">
      <div className="glass-panel overflow-hidden border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary text-white">
              <Layers3 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-semibold">Visual Trace Studio</h3>
              <p className="text-xs text-foreground/60">{runnableCount} validated runnable example{runnableCount === 1 ? "" : "s"}</p>
            </div>
          </div>
          <StatusPill status={status} />
        </div>

        <div className="grid gap-4 p-4">
          <label className="grid gap-2 text-sm font-medium">
            Example
            <select
              className="h-10 border border-border bg-background px-3 text-sm outline-none"
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

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-2 text-sm font-medium">
              Trace depth
              <input
                aria-label="Trace depth"
                className="h-10 accent-primary"
                max="260"
                min="30"
                type="range"
                value={maxSteps}
                onChange={(event) => setMaxSteps(Number(event.target.value))}
              />
            </label>
            <div className="grid content-end">
              <span className="border border-border bg-muted px-4 py-2 text-sm font-semibold">{maxSteps} steps</span>
            </div>
          </div>

          <textarea
            aria-label="Trace standard input"
            className="min-h-20 resize-y border border-border bg-background p-3 font-mono text-sm outline-none"
            placeholder="stdin"
            value={stdin}
            onChange={(event) => setStdin(event.target.value)}
          />

          <textarea
            aria-label="Trace source code"
            className="h-64 resize-y border border-border bg-foreground p-4 font-mono text-sm leading-6 text-background outline-none"
            spellCheck={false}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setSelectedSample("source");
              setResult(null);
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

          {error && <div className="border border-accent/60 bg-accent/10 p-3 text-sm text-accent">{error}</div>}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <TracePlayback
            activeIndex={activeIndex}
            currentLine={currentLine}
            result={result}
            step={activeStep}
            onMove={moveStep}
            onSeek={setActiveIndex}
          />
          <TraceScene step={activeStep} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <VariableBoard step={activeStep} />
          <OutputAndLogs result={result} />
        </div>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const isBusy = status === "tracing";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide">
      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Cpu className="h-3.5 w-3.5" aria-hidden />}
      {status}
    </span>
  );
}

function TracePlayback({
  activeIndex,
  currentLine,
  result,
  step,
  onMove,
  onSeek
}: {
  activeIndex: number;
  currentLine: string;
  result: VisualizeResult | null;
  step: TraceStep | null;
  onMove: (delta: number) => void;
  onSeek: (index: number) => void;
}) {
  const total = result?.steps.length ?? 0;
  const visibleSteps = useMemo(() => {
    if (!result?.steps.length) return [];
    const start = Math.max(0, activeIndex - 5);
    return result.steps.slice(start, start + 11);
  }, [activeIndex, result]);

  return (
    <div className="glass-panel grid min-h-[360px] gap-4 border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Trace Playback</h3>
          <p className="text-xs text-foreground/60">
            {currentLine} {step ? `in ${step.function}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="h-9 w-9 px-0" variant="secondary" onClick={() => onMove(-1)} disabled={!total || activeIndex === 0}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span className="min-w-24 text-center text-sm font-semibold">
            {total ? `${activeIndex + 1} / ${total}` : "0 / 0"}
          </span>
          <Button className="h-9 w-9 px-0" variant="secondary" onClick={() => onMove(1)} disabled={!total || activeIndex === total - 1}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

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

      <div className="grid gap-3">
        <div className="border border-border bg-foreground p-4 text-background">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-background/70">
            <Terminal className="h-3.5 w-3.5" aria-hidden />
            Active line
          </div>
          <code className="block min-h-14 whitespace-pre-wrap break-words text-sm">{step?.line_text?.trim() || "Press Visualize to capture execution steps."}</code>
        </div>
        <div className="border border-border bg-muted/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/60">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Narration
          </div>
          <p className="min-h-12 text-sm">{step?.narration ?? "The visualizer will explain each captured execution frame here."}</p>
        </div>
      </div>

      <div className="grid max-h-56 gap-2 overflow-auto pr-1">
        {visibleSteps.length ? (
          visibleSteps.map((item) => (
            <button
              className={`grid grid-cols-[72px_1fr_auto] items-center gap-3 border px-3 py-2 text-left text-sm transition ${
                item.index - 1 === activeIndex ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted"
              }`}
              key={`${item.index}-${item.line_no}-${item.event}`}
              onClick={() => onSeek(item.index - 1)}
              type="button"
            >
              <span className="font-semibold">#{item.index}</span>
              <span className="truncate font-mono text-xs">{item.line_text.trim() || item.event}</span>
              <span className="text-xs uppercase text-foreground/60">{item.event}</span>
            </button>
          ))
        ) : (
          <div className="border border-dashed border-border p-4 text-sm text-foreground/60">No trace frames captured yet.</div>
        )}
      </div>
    </div>
  );
}

function TraceScene({ step }: { step: TraceStep | null }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const metrics = useMemo(() => collectNumericValues(step), [step]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 360;
    const height = mount.clientHeight || 320;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    const group = new THREE.Group();
    const colorA = new THREE.Color("#38bdf8");
    const colorB = new THREE.Color("#14b8a6");
    const colorC = new THREE.Color("#f59e0b");
    const values = metrics.length ? metrics : [1, 3, 2, 4, 2, 5];

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);
    scene.add(group);
    camera.position.set(0, 4.4, 8.4);
    camera.lookAt(0, 0.4, 0);

    const max = Math.max(...values.map((value) => Math.abs(value)), 1);
    const spacing = Math.min(1.05, 8 / Math.max(values.length, 1));
    values.slice(0, 24).forEach((value, index) => {
      const heightValue = Math.max(0.25, (Math.abs(value) / max) * 3.8);
      const geometry = new THREE.BoxGeometry(0.56, heightValue, 0.56);
      const material = new THREE.MeshStandardMaterial({
        color: index % 3 === 0 ? colorA : index % 3 === 1 ? colorB : colorC,
        metalness: 0.18,
        roughness: 0.38
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((index - (values.length - 1) / 2) * spacing, heightValue / 2 - 1.6, Math.sin(index) * 0.42);
      group.add(mesh);
    });

    const planeGeometry = new THREE.CircleGeometry(4.8, 64);
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x94a3b8, opacity: 0.12, transparent: true });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -1.72;
    group.add(plane);

    let frameId = 0;
    const animate = () => {
      group.rotation.y += 0.006;
      group.rotation.x = Math.sin(Date.now() / 1200) * 0.04;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(280, entry.contentRect.width);
      const nextHeight = Math.max(280, entry.contentRect.height);
      renderer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(mount);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frameId);
      renderer.dispose();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      mount.removeChild(renderer.domElement);
    };
  }, [metrics]);

  return (
    <div className="glass-panel grid min-h-[360px] overflow-hidden border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="text-base font-semibold">3D Data Field</h3>
          <p className="text-xs text-foreground/60">{metrics.length ? `${metrics.length} numeric signal${metrics.length === 1 ? "" : "s"}` : "ambient preview"}</p>
        </div>
        <Box className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <div ref={mountRef} className="min-h-[300px] w-full" />
    </div>
  );
}

function VariableBoard({ step }: { step: TraceStep | null }) {
  const locals = step?.locals ?? [];
  const arrays = locals.filter((local) => local.numeric_items.length > 0);

  return (
    <div className="glass-panel grid gap-4 border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">2D Variable Map</h3>
          <p className="text-xs text-foreground/60">{locals.length} visible value{locals.length === 1 ? "" : "s"}</p>
        </div>
        <Gauge className="h-5 w-5 text-primary" aria-hidden />
      </div>

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
          <div className="border border-dashed border-border p-4 text-sm text-foreground/60">Trace a run to populate live variables.</div>
        )}
      </div>
    </div>
  );
}

function ArrayBars({ value }: { value: TraceValue }) {
  const numbers = value.numeric_items.slice(0, 18);
  const max = Math.max(...numbers.map((number) => Math.abs(number)), 1);
  return (
    <div className="border border-border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">{value.name}</span>
        <span className="text-xs text-foreground/60">{value.size ?? numbers.length} item{value.size === 1 ? "" : "s"}</span>
      </div>
      <div className="flex h-36 items-end gap-1 overflow-hidden">
        {numbers.map((number, index) => (
          <div className="flex min-w-6 flex-1 flex-col items-center gap-1" key={`${value.name}-${index}-${number}`}>
            <div
              className="w-full rounded-t-sm bg-primary/80 shadow-sm"
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
    <div className="grid gap-2 border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          {icon}
          <span className="truncate">{value.name}</span>
        </span>
        <span className="shrink-0 text-xs uppercase text-foreground/60">{value.kind}</span>
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

function OutputAndLogs({ result }: { result: VisualizeResult | null }) {
  const logs = result?.logs?.length ? result.logs : ["No trace logs yet."];
  return (
    <div className="grid gap-4">
      <div className="glass-panel grid gap-3 border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Output</h3>
          <span className="text-xs font-semibold uppercase text-foreground/60">{result?.status ?? "ready"}</span>
        </div>
        <pre className="max-h-44 min-h-32 overflow-auto border border-border bg-foreground p-3 text-sm text-background">
          {result?.output || "Trace output will appear here."}
        </pre>
      </div>
      <div className="glass-panel grid gap-3 border border-border p-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-primary" aria-hidden />
          Logs
        </div>
        <div className="grid max-h-56 gap-2 overflow-auto border border-border bg-muted/50 p-3 text-xs">
          {logs.map((line, index) => (
            <span className="break-words font-mono" key={`${index}-${line}`}>
              {line}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function collectNumericValues(step: TraceStep | null): number[] {
  if (!step) return [];
  return step.locals.flatMap((local) => local.numeric_items).slice(0, 24);
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
