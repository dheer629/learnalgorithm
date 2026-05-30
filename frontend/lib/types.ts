export type Category = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  algorithm_count: number;
};

export type AlgorithmSummary = {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  description?: string | null;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced" | string;
};

export type AlgorithmDetail = AlgorithmSummary & {
  source_path: string;
  source_url: string;
  source_code: string;
  functions: Array<{ name: string; signature: string; docstring?: string; lineno: number }>;
  doctests: string[];
  examples: AlgorithmExample[];
  complexity: { time?: string | null; space?: string | null };
  related: AlgorithmSummary[];
};

export type AlgorithmExample = {
  title: string;
  command: string;
  runnable_code: string;
  stdin: string;
  expected_output: string;
  actual_output: string;
  matched: boolean | null;
  status: "matched" | "not-matched" | "ran" | "blocked" | "failed" | string;
  validation_error?: string | null;
  execution_time_ms?: number | null;
  runner?: string | null;
  python_version?: string | null;
  exit_code?: number | null;
  logs: string[];
};

export type ExecuteResult = {
  stdout: string;
  stderr: string;
  output: string;
  execution_time_ms: number | null;
  status: string;
  runner: string;
  python_version?: string | null;
  exit_code?: number | null;
  logs: string[];
};

export type TraceValue = {
  name: string;
  kind: string;
  preview: string;
  size?: number | null;
  items: Array<Record<string, unknown>>;
  numeric_items: number[];
};

export type TraceStep = {
  index: number;
  event: string;
  line_no?: number | null;
  line_text: string;
  function: string;
  locals: TraceValue[];
  stdout: string;
  stderr: string;
  narration: string;
};

export type VisualizeResult = {
  stdout: string;
  stderr: string;
  output: string;
  execution_time_ms: number | null;
  status: string;
  runner: string;
  python_version?: string | null;
  exit_code?: number | null;
  steps: TraceStep[];
  logs: string[];
};
