import type { AlgorithmDetail, AlgorithmSummary, Category } from "@/lib/types";

const BROWSER_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const SERVER_API_URL = process.env.SERVER_API_URL ?? BROWSER_API_URL;

function apiUrl() {
  return typeof window === "undefined" ? SERVER_API_URL : BROWSER_API_URL;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    next: { revalidate: 60 }
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  categories: () => fetchJson<Category[]>("/categories"),
  algorithms: (params?: { category?: string; q?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.q) query.set("q", params.q);
    return fetchJson<AlgorithmSummary[]>(`/algorithms?${query.toString()}`);
  },
  algorithm: (slug: string) => fetchJson<AlgorithmDetail>(`/algorithms/${slug}`),
  execute: (code: string, stdin = "") =>
    fetchJson<{ stdout: string; stderr: string; output: string; execution_time_ms: number | null }>("/execute", {
      method: "POST",
      body: JSON.stringify({ code, stdin, args: [] }),
      next: { revalidate: 0 }
    })
};
