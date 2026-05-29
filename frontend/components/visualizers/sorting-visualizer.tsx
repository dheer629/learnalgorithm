"use client";

import { Pause, Play, RotateCcw, StepForward } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const seed = [36, 12, 84, 48, 18, 72, 30, 60];

function bubbleSteps(values: number[]) {
  const arr = [...values];
  const steps = [{ values: [...arr], active: [] as number[] }];
  for (let i = 0; i < arr.length; i += 1) {
    for (let j = 0; j < arr.length - i - 1; j += 1) {
      steps.push({ values: [...arr], active: [j, j + 1] });
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        steps.push({ values: [...arr], active: [j, j + 1] });
      }
    }
  }
  return steps;
}

export function SortingVisualizer() {
  const steps = useMemo(() => bubbleSteps(seed), []);
  const [index, setIndex] = useState(0);
  const step = steps[index];

  return (
    <section className="grid gap-4 border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Sorting Visualizer</h2>
        <div className="flex gap-2">
          <Button variant="secondary" aria-label="Reset" onClick={() => setIndex(0)}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="secondary" aria-label="Previous step" onClick={() => setIndex(Math.max(0, index - 1))}>
            <Pause className="h-4 w-4" />
          </Button>
          <Button variant="secondary" aria-label="Next step" onClick={() => setIndex(Math.min(steps.length - 1, index + 1))}>
            <StepForward className="h-4 w-4" />
          </Button>
          <Button aria-label="Play one step" onClick={() => setIndex(Math.min(steps.length - 1, index + 1))}>
            <Play className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex h-56 items-end gap-2 border border-border bg-muted p-3" role="img" aria-label="Bars representing sortable values">
        {step.values.map((value, itemIndex) => (
          <div
            key={`${itemIndex}-${value}`}
            className={step.active.includes(itemIndex) ? "w-full bg-accent" : "w-full bg-primary"}
            style={{ height: `${value}%` }}
            title={`${value}`}
          />
        ))}
      </div>
      <p className="text-sm text-foreground/70">
        Step {index + 1} of {steps.length}
      </p>
    </section>
  );
}

