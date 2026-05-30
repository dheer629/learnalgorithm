import { BookOpen, CheckCircle2, FlaskConical, Lightbulb, ListChecks, ShieldAlert, Target } from "lucide-react";
import type React from "react";
import type { LearningGuide as LearningGuideModel } from "@/lib/learning";
import { Card } from "@/components/ui/card";

export function LearningGuide({ guide }: { guide: LearningGuideModel }) {
  return (
    <section className="grid gap-4">
      <h2 className="text-2xl font-semibold">Learn This Algorithm</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="grid gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
            What it does
          </div>
          <p className="text-sm leading-6 text-foreground/75">{guide.whatItDoes}</p>
        </Card>
        <Card className="grid gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <FlaskConical className="h-5 w-5 text-primary" aria-hidden />
            When to use it
          </div>
          <p className="text-sm leading-6 text-foreground/75">{guide.whenToUse}</p>
        </Card>
        <Card className="grid gap-3">
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
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <NoteList icon={<ShieldAlert className="h-5 w-5 text-accent" aria-hidden />} title="Common pitfalls" notes={guide.commonPitfalls} />
        <NoteList icon={<Lightbulb className="h-5 w-5 text-primary" aria-hidden />} title="Interview notes" notes={guide.interviewNotes} />
        <NoteList icon={<Target className="h-5 w-5 text-primary" aria-hidden />} title="Real-world use cases" notes={guide.realWorldUseCases} />
      </div>
      {guide.example && (
        <Card className="grid gap-3">
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
        </Card>
      )}
    </section>
  );
}

function NoteList({ icon, title, notes }: { icon: React.ReactNode; title: string; notes: string[] }) {
  return (
    <Card className="grid gap-3">
      <div className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </div>
      <ul className="grid gap-2 text-sm leading-6 text-foreground/75">
        {notes.map((note) => (
          <li className="flex gap-2" key={note}>
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
