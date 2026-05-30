import { describe, expect, it } from "vitest";
import { buildLearningGuide } from "./learning";
import type { AlgorithmDetail } from "./types";

const algorithm: AlgorithmDetail = {
  id: "1",
  slug: "searches/binary-search",
  name: "Binary Search",
  category_slug: "searches",
  description: "Find a target in a sorted collection.",
  tags: ["searches", "binary-search"],
  difficulty: "beginner",
  source_path: "searches/binary_search.py",
  source_url: "https://example.com/binary_search.py",
  source_code: "def binary_search(values, target):\n    return values.index(target)\n",
  functions: [{ name: "binary_search", signature: "binary_search(values, target)", lineno: 1 }],
  imports: [],
  doctests: ["binary_search([1, 2], 2)"],
  examples: [],
  complexity: { time: "O(log n)", space: null },
  related: []
};

describe("buildLearningGuide", () => {
  it("uses extracted metadata for learning notes", () => {
    const guide = buildLearningGuide(algorithm);

    expect(guide.whatItDoes).toContain("Find a target");
    expect(guide.whenToUse).toContain("O(log n)");
    expect(guide.interviewNotes.some((note) => note.includes("binary_search"))).toBe(true);
    expect(guide.commonPitfalls.length).toBeGreaterThan(0);
  });
});
