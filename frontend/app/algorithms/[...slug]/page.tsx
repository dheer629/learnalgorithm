import { AlgorithmWorkspace } from "@/components/algorithm-workspace";
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

  return <AlgorithmWorkspace algorithm={algorithm} guide={guide} samples={samples} />;
}
