import Link from "next/link";
import { AlgorithmVisualLab } from "@/components/algorithm-visual-lab";
import { CodeRunner } from "@/components/code-runner";
import { LearningGuide } from "@/components/learning-guide";
import { api } from "@/lib/api";
import { buildLearningGuide } from "@/lib/learning";

export const dynamic = "force-dynamic";

export default async function AlgorithmPage({ params }: { params: { slug: string[] } }) {
  const slug = params.slug.join("/");
  const algorithm = await api.algorithm(slug);
  const guide = buildLearningGuide(algorithm);
  const samples = algorithm.examples.map((example) => ({
    title: example.title,
    command: example.command,
    code: example.runnable_code,
    stdin: example.stdin,
    expectedOutput: example.expected_output,
    actualOutput: example.actual_output,
    matched: example.matched,
    status: example.status,
    validationError: example.validation_error,
    executionTimeMs: example.execution_time_ms,
    runner: example.runner,
    pythonVersion: example.python_version,
    exitCode: example.exit_code,
    logs: example.logs
  }));
  return (
    <article className="grid gap-8">
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
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-4xl font-bold">{algorithm.name}</h1>
          <span className="border border-border px-2 py-1 text-sm">{algorithm.difficulty}</span>
        </div>
        <p className="max-w-4xl text-lg text-foreground/75">{algorithm.description}</p>
        <a className="text-sm underline" href={algorithm.source_url}>
          View original source
        </a>
      </header>
      <section className="grid gap-3 md:grid-cols-2">
        <div className="border border-border p-4">
          <h2 className="mb-3 text-lg font-semibold">Complexity</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <th className="py-2 text-left">Time</th>
                <td>{algorithm.complexity.time ?? "Not annotated"}</td>
              </tr>
              <tr>
                <th className="py-2 text-left">Space</th>
                <td>{algorithm.complexity.space ?? "Not annotated"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border border-border p-4">
          <h2 className="mb-3 text-lg font-semibold">Functions</h2>
          <ul className="grid gap-2 text-sm">
            {algorithm.functions.slice(0, 6).map((fn) => (
              <li key={`${fn.name}-${fn.lineno}`}>
                <code>{fn.signature}</code>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <LearningGuide guide={guide} />
      <section className="grid gap-3">
        <h2 className="text-2xl font-semibold">Visualize the Process</h2>
        <AlgorithmVisualLab sourceCode={algorithm.source_code} samples={samples} />
      </section>
      <section className="grid gap-3">
        <h2 className="text-2xl font-semibold">Run and Experiment</h2>
        <CodeRunner sourceCode={algorithm.source_code} sample={guide.example} samples={samples} />
      </section>
      {algorithm.doctests.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-2xl font-semibold">Runnable Examples</h2>
          <pre className="overflow-auto border border-border bg-muted p-4 text-sm">{algorithm.doctests.join("\n")}</pre>
        </section>
      )}
      <section className="grid gap-3">
        <h2 className="text-2xl font-semibold">Related Algorithms</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {algorithm.related.map((item) => (
            <Link className="border border-border p-4 hover:bg-muted" href={`/algorithms/${item.slug}`} key={item.id}>
              {item.name}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
