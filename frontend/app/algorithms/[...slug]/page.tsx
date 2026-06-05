import { AlgorithmWorkspace } from "@/components/algorithm-workspace";
import { notFound } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { buildLearningGuide } from "@/lib/learning";

export const dynamic = "force-dynamic";

type AlgorithmPageProps = {
  params: Promise<{ slug: string[] }>;
};

export default async function AlgorithmPage({ params }: AlgorithmPageProps) {
  const { slug: slugParts } = await params;
  const slug = slugParts.join("/");
  const algorithm = await loadAlgorithm(slug);
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

async function loadAlgorithm(slug: string) {
  try {
    return await api.algorithm(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
