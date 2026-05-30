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
};
