"use client";

import { Play, Type } from "lucide-react";
import { useState, useTransition } from "react";
import { api } from "@/lib/api";
import { usePreferences } from "@/store/preferences";
import { Button } from "@/components/ui/button";

export function CodeRunner({ sourceCode }: { sourceCode: string }) {
  const [code, setCode] = useState(sourceCode);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("Run the algorithm to see output here.");
  const [isPending, startTransition] = useTransition();
  const { codeFontSize, setCodeFontSize } = usePreferences();

  function run() {
    startTransition(async () => {
      try {
        const result = await api.execute(code, stdin);
        setOutput(result.output || result.stdout || result.stderr || "Execution finished without output.");
      } catch (error) {
        setOutput(error instanceof Error ? error.message : "Execution failed.");
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
        <pre className="min-h-56 overflow-auto border border-border bg-foreground p-3 text-sm text-background">
          {output}
        </pre>
      </aside>
    </section>
  );
}

