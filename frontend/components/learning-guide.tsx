import { BookOpen, CheckCircle2, FlaskConical, ListChecks } from "lucide-react";
import type { LearningGuide as LearningGuideModel } from "@/lib/learning";

export function LearningGuide({ guide }: { guide: LearningGuideModel }) {
  return (
    <section className="grid gap-4">
      <h2 className="text-2xl font-semibold">Learn This Algorithm</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-3 border border-border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
            What it does
          </div>
          <p className="text-sm leading-6 text-foreground/75">{guide.whatItDoes}</p>
        </div>
        <div className="grid gap-3 border border-border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <FlaskConical className="h-5 w-5 text-primary" aria-hidden />
            When to use it
          </div>
          <p className="text-sm leading-6 text-foreground/75">{guide.whenToUse}</p>
        </div>
        <div className="grid gap-3 border border-border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <ListChecks className="h-5 w-5 text-primary" aria-hidden />
            What to do
          </div>
          <ol className="grid gap-2 text-sm leading-6 text-foreground/75">
            {guide.howToRun.map((step) => (
              <li key={step} className="flex gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {guide.example && (
        <div className="grid gap-3 border border-border p-4">
          <h3 className="text-lg font-semibold">Sample Values</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Sample call</span>
              <pre className="overflow-auto border border-border bg-muted p-3 text-sm">{guide.example.command}</pre>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Expected output</span>
              <pre className="min-h-12 overflow-auto border border-border bg-muted p-3 text-sm">
                {guide.example.expectedOutput || "Run the sample to calculate the output."}
              </pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
