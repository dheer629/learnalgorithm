import type { AlgorithmDetail } from "@/lib/types";

export type LearningExample = {
  command: string;
  code: string;
  stdin: string;
  expectedOutput: string;
};

export type LearningGuide = {
  whatItDoes: string;
  whenToUse: string;
  howToRun: string[];
  commonPitfalls: string[];
  interviewNotes: string[];
  realWorldUseCases: string[];
  example: LearningExample | null;
};

type ParsedDoctest = {
  command: string;
  expectedOutput: string;
};

export function buildLearningGuide(algorithm: AlgorithmDetail): LearningGuide {
  const primaryFunction = algorithm.functions[0];
  const validatedExample = algorithm.examples[0];
  const command = validatedExample?.command ?? algorithm.doctests[0] ?? "";
  const expectedOutput = validatedExample?.expected_output ?? "";
  const runnableCode = validatedExample?.runnable_code ?? buildExampleCode(algorithm.source_code, command);
  const example = command
    ? {
        command,
        code: runnableCode,
        stdin: "",
        expectedOutput
      }
    : null;

  return {
    whatItDoes: buildWhatItDoes(algorithm),
    whenToUse: buildWhenToUse(algorithm),
    howToRun: [
      primaryFunction
        ? `Find the main function, usually ${primaryFunction.signature}, and call it with sample values.`
        : "Read the source code from top to bottom and identify the input values it expects.",
      "Use the editable Python panel to change the values, then press Run.",
      "Compare the Actual output with Expected output. Matching output means the sample behaved as intended."
    ],
    commonPitfalls: buildPitfalls(algorithm),
    interviewNotes: buildInterviewNotes(algorithm),
    realWorldUseCases: buildUseCases(algorithm),
    example
  };
}

function buildWhatItDoes(algorithm: AlgorithmDetail) {
  const category = algorithm.category_slug.replaceAll("-", " ");
  const fn = algorithm.functions[0]?.name?.replaceAll("_", " ");
  const base = algorithm.description?.trim();
  if (base) {
    return `${base} In practice, this ${category} algorithm turns a well-defined input into a predictable result so you can inspect each step and test your understanding.`;
  }
  if (fn) {
    return `${algorithm.name} focuses on the ${fn} operation. It takes input values, applies the algorithmic rule in the source code, and returns or prints the result.`;
  }
  return `${algorithm.name} is an algorithm from the ${category} category. Use the source code and sample run to see how input is transformed into output.`;
}

function buildWhenToUse(algorithm: AlgorithmDetail) {
  const category = algorithm.category_slug.replaceAll("-", " ");
  const complexity = algorithm.complexity.time ? ` Its annotated time complexity is ${algorithm.complexity.time}.` : "";
  return `Use it when you are solving a ${category} problem with similar inputs or when you want to practice recognizing this pattern.${complexity}`;
}

function buildPitfalls(algorithm: AlgorithmDetail) {
  const notes = ["Check input ordering, empty inputs, duplicate values, and boundary indexes before trusting a run."];
  if (!algorithm.complexity.time && !algorithm.complexity.space) {
    notes.push("Complexity is not annotated in the source metadata, so inspect loops and recursion depth manually.");
  }
  if (algorithm.functions.length > 3) {
    notes.push("This file has multiple helper functions; trace the primary call path before changing internals.");
  }
  return notes;
}

function buildInterviewNotes(algorithm: AlgorithmDetail) {
  const primaryFunction = algorithm.functions[0]?.signature;
  return [
    primaryFunction ? `Be ready to explain the contract of ${primaryFunction}.` : "Be ready to state the input and output contract.",
    "Walk through one small example aloud and name the invariant that stays true after each step.",
    algorithm.complexity.time
      ? `Mention the extracted time complexity: ${algorithm.complexity.time}.`
      : "Derive time complexity from the loops, recursion, and data structures in the source."
  ];
}

function buildUseCases(algorithm: AlgorithmDetail) {
  const category = algorithm.category_slug.replaceAll("-", " ");
  return [
    `Practice ${category} pattern recognition with executable source.`,
    "Compare expected and actual output when changing inputs.",
    "Use trace frames to debug how intermediate values move through the algorithm."
  ];
}

function buildExampleCode(sourceCode: string, command: string) {
  const runnableCommand = needsPrint(command) ? `print(repr(${command}))` : command;
  return `${sourceCode.trimEnd()}\n\nif __name__ == "__main__":\n    ${runnableCommand}`;
}

function needsPrint(command: string) {
  const trimmed = command.trim();
  return !trimmed.startsWith("print(") && !trimmed.includes("=") && !trimmed.startsWith("assert ");
}

export function parseDoctestExamples(sourceCode: string): ParsedDoctest[] {
  const lines = sourceCode.split(/\r?\n/);
  const examples: ParsedDoctest[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const prompt = lines[index].match(/^\s*>>>\s+(.+)$/);
    if (!prompt) continue;

    const expected: string[] = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next];
      if (/^\s*(>>>|\.\.\.)\s+/.test(line)) break;
      if (/^\s*("|''')?\s*$/.test(line)) break;
      expected.push(line.replace(/^\s+/, ""));
    }

    examples.push({
      command: prompt[1].trim(),
      expectedOutput: expected.join("\n").trim()
    });
  }

  return examples;
}
