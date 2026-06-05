"use client";

import Link from "next/link";
import { BarChart3, BookOpen, Braces, Code2, FlaskConical, ListChecks, Network, NotebookText, Play } from "lucide-react";
import type React from "react";
import { useEffect, useMemo } from "react";
import { AlgorithmVisualLab } from "@/components/algorithm-visual-lab";
import { CodeRunner } from "@/components/code-runner";
import { LearningGuide } from "@/components/learning-guide";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import type { LearningGuide as LearningGuideModel } from "@/lib/learning";
import type { AlgorithmDetail } from "@/lib/types";
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

const tabItems = [
  { id: "overview", label: "Overview", icon: <BookOpen className="h-4 w-4" aria-hidden /> },
  { id: "code", label: "Code", icon: <Code2 className="h-4 w-4" aria-hidden /> },
  { id: "run", label: "Run", icon: <Play className="h-4 w-4" aria-hidden /> },
  { id: "visualize", label: "Visualize", icon: <BarChart3 className="h-4 w-4" aria-hidden /> },
  { id: "examples", label: "Examples", icon: <ListChecks className="h-4 w-4" aria-hidden /> },
  { id: "notes", label: "Notes", icon: <NotebookText className="h-4 w-4" aria-hidden /> }
];

export function AlgorithmWorkspace({
  algorithm,
  guide,
  samples
}: {
  algorithm: AlgorithmDetail;
  guide: LearningGuideModel;
  samples: SampleRun[];
}) {
  const { lastSelectedTab, setLastSelectedTab } = usePreferences();
  const activeTab = tabItems.some((item) => item.id === lastSelectedTab) ? lastSelectedTab : "overview";
  const primaryFunction = algorithm.functions[0];

  useEffect(() => {
    const item = { name: algorithm.name, slug: algorithm.slug, category: algorithm.category_slug };
    try {
      const stored = window.localStorage.getItem("algolearn-recent");
      const existing = stored ? JSON.parse(stored) : [];
      const next = [item, ...existing.filter((value: { slug: string }) => value.slug !== item.slug)].slice(0, 8);
      window.localStorage.setItem("algolearn-recent", JSON.stringify(next));
      window.dispatchEvent(new Event("algolearn-recent-updated"));
    } catch {
      // Recently viewed is a convenience layer; ignore localStorage failures.
    }
  }, [algorithm.category_slug, algorithm.name, algorithm.slug]);

  const sourceLines = useMemo(() => algorithm.source_code.split(/\r?\n/), [algorithm.source_code]);

  return (
    <article className="grid gap-6">
      <nav className="text-sm text-foreground/70">
        <Link href="/" className="underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href={`/categories/${algorithm.category_slug}`} className="underline">
          {algorithm.category_slug}
        </Link>{" "}
        / {algorithm.name}
      </nav>

      <header className="grid gap-4 rounded-lg border border-border bg-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{algorithm.category_slug.replaceAll("-", " ")}</Badge>
          <Badge tone="muted">{algorithm.difficulty}</Badge>
          {algorithm.tags.slice(0, 6).map((tag) => (
            <Badge tone="muted" key={tag}>
              {tag}
            </Badge>
          ))}
        </div>
        <div className="grid gap-3">
          <h1 className="text-4xl font-bold tracking-tight">{algorithm.name}</h1>
          <p className="max-w-5xl text-lg leading-8 text-foreground/75">{algorithm.description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a className="text-sm font-semibold underline" href={algorithm.source_url}>
            View original source
          </a>
          {primaryFunction && <span className="text-sm text-foreground/65">Primary function: {primaryFunction.signature}</span>}
        </div>
      </header>

      <Tabs active={activeTab} items={tabItems} onChange={setLastSelectedTab} />

      {activeTab === "overview" && (
        <div className="grid gap-5">
          <section className="grid gap-4 lg:grid-cols-3">
            <ComplexityPanel algorithm={algorithm} />
            <FunctionPanel algorithm={algorithm} />
            <MetadataPanel algorithm={algorithm} />
          </section>
          <LearningGuide guide={guide} />
          <RelatedAlgorithms algorithm={algorithm} />
        </div>
      )}

      {activeTab === "code" && (
        <section className="grid gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Source Code</CardTitle>
                <CardDescription>{sourceLines.length} lines extracted from TheAlgorithms/Python.</CardDescription>
              </div>
              <Badge tone="muted">{algorithm.imports.length} imports</Badge>
            </CardHeader>
            <pre className="max-h-[720px] overflow-auto rounded-md border border-border bg-foreground p-4 text-sm leading-6 text-background">
              {algorithm.source_code}
            </pre>
          </Card>
        </section>
      )}

      {activeTab === "run" && <CodeRunner sourceCode={algorithm.source_code} sample={guide.example} samples={samples} />}

      {activeTab === "visualize" && <AlgorithmVisualLab sourceCode={algorithm.source_code} samples={samples} />}

      {activeTab === "examples" && (
        <section className="grid gap-4">
          {samples.length ? (
            samples.map((sample, index) => (
              <Card key={`${sample.title}-${index}`} className="grid gap-3">
                <CardHeader className="mb-0">
                  <CardTitle>{sample.title ?? `Example ${index + 1}`}</CardTitle>
                  <Badge tone={sample.matched ? "success" : sample.matched === false ? "danger" : "muted"}>
                    {sample.status ?? "ready"}
                  </Badge>
                </CardHeader>
                {sample.command && <pre className="overflow-auto rounded-md border border-border bg-muted p-3 text-sm">{sample.command}</pre>}
                <div className="grid gap-3 md:grid-cols-2">
                  <Output title="Expected output" value={sample.expectedOutput || "No expected output annotated."} />
                  <Output title="Validated output" value={sample.actualOutput || sample.validationError || "Not validated yet."} />
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <CardTitle>No runnable examples found</CardTitle>
              <CardDescription>Open the Run tab to create your own input and execute the source code.</CardDescription>
            </Card>
          )}
        </section>
      )}

      {activeTab === "notes" && (
        <section className="grid gap-4 lg:grid-cols-3">
          <LearningNote title="What this solves" value={guide.whatItDoes} icon={<FlaskConical className="h-5 w-5 text-primary" />} />
          <LearningNote title="When to use it" value={guide.whenToUse} icon={<Network className="h-5 w-5 text-primary" />} />
          <LearningNote
            title="Practical cue"
            value="Use the Run and Visualize tabs together: first confirm output, then inspect the trace frames where values change."
            icon={<Braces className="h-5 w-5 text-primary" />}
          />
        </section>
      )}
    </article>
  );
}

function ComplexityPanel({ algorithm }: { algorithm: AlgorithmDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Complexity</CardTitle>
        <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
      </CardHeader>
      <dl className="grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
          <dt className="font-semibold">Time</dt>
          <dd>{algorithm.complexity.time ?? "Not annotated"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="font-semibold">Space</dt>
          <dd>{algorithm.complexity.space ?? "Not annotated"}</dd>
        </div>
      </dl>
    </Card>
  );
}

function FunctionPanel({ algorithm }: { algorithm: AlgorithmDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Functions</CardTitle>
        <Code2 className="h-5 w-5 text-primary" aria-hidden />
      </CardHeader>
      <ul className="grid gap-2 text-sm">
        {algorithm.functions.slice(0, 6).map((fn) => (
          <li key={`${fn.name}-${fn.lineno}`}>
            <code className="break-words">{fn.signature}</code>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MetadataPanel({ algorithm }: { algorithm: AlgorithmDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata</CardTitle>
        <Badge tone="muted">{algorithm.imports.length} imports</Badge>
      </CardHeader>
      <div className="flex flex-wrap gap-2">
        {algorithm.imports.length ? (
          algorithm.imports.slice(0, 10).map((item) => (
            <Badge tone="muted" key={item}>
              {item}
            </Badge>
          ))
        ) : (
          <CardDescription>No imports extracted from this file.</CardDescription>
        )}
      </div>
    </Card>
  );
}

function RelatedAlgorithms({ algorithm }: { algorithm: AlgorithmDetail }) {
  if (!algorithm.related.length) return null;
  return (
    <section className="grid gap-3">
      <h2 className="text-2xl font-semibold">Related Algorithms</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {algorithm.related.map((item) => (
          <Link className="rounded-lg border border-border bg-panel p-4 hover:bg-muted" href={`/algorithms/${item.slug}`} key={item.id}>
            {item.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Output({ title, value }: { title: string; value: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold">{title}</span>
      <pre className="min-h-28 overflow-auto rounded-md border border-border bg-foreground p-3 text-sm text-background">{value}</pre>
    </div>
  );
}

function LearningNote({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <Card className="grid gap-3">
      <div className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </div>
      <p className="text-sm leading-6 text-foreground/75">{value}</p>
    </Card>
  );
}
