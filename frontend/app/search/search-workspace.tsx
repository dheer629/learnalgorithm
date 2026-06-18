"use client";

import Link from "next/link";
import { Filter, Search, SlidersHorizontal, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";
import { usePreferences } from "@/store/preferences";

const difficulties = ["beginner", "intermediate", "advanced"];
const sortOptions = [
  { value: "relevance", label: "Relevance" },
  { value: "name", label: "Name" },
  { value: "difficulty", label: "Difficulty" },
  { value: "category", label: "Category" },
  { value: "-name", label: "Name desc" }
];

type SearchFilters = {
  q?: string;
  category?: string;
  difficulty?: string;
  tags?: string;
  sort?: string;
};

export function SearchWorkspace({ categories, initialFilters }: { categories: Category[]; initialFilters: SearchFilters }) {
  const { lastSearchFilters, setLastSearchFilters } = usePreferences();
  const [q, setQ] = useState(initialFilters.q || lastSearchFilters.q);
  const [category, setCategory] = useState(initialFilters.category || lastSearchFilters.category);
  const [difficulty, setDifficulty] = useState(initialFilters.difficulty || lastSearchFilters.difficulty);
  const [tags, setTags] = useState(initialFilters.tags || lastSearchFilters.tags);
  const [sort, setSort] = useState(initialFilters.sort || lastSearchFilters.sort || "relevance");
  const [page, setPage] = useState(1);
  const [debouncedQuery, setDebouncedQuery] = useState(q);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(q), 260);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setLastSearchFilters({ q, category, difficulty, tags, sort });
  }, [category, difficulty, q, setLastSearchFilters, sort, tags]);

  const query = useQuery({
    queryKey: ["algorithm-search", debouncedQuery, category, difficulty, tags, sort, page],
    queryFn: () =>
      api.algorithmSearch({
        q: debouncedQuery,
        category,
        difficulty,
        tags,
        sort,
        page,
        pageSize: 30
      })
  });

  const result = query.data;
  const hasFilters = Boolean(q || category || difficulty || tags);
  const suggestions = useMemo(() => categories.slice(0, 6), [categories]);

  function clearFilters() {
    setQ("");
    setCategory("");
    setDifficulty("");
    setTags("");
    setSort("name");
    setPage(1);
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-lg border border-border bg-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Search Algorithms</h1>
            <p className="text-sm text-foreground/70">Filter by category, difficulty, tags, and source metadata.</p>
          </div>
          <Badge tone="muted">{result?.meta.total ?? 0} results</Badge>
        </div>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-foreground/60" aria-hidden />
          <input
            aria-label="Search query"
            className="h-11 w-full rounded-md border border-border bg-background pl-10 pr-4 text-sm"
            placeholder="Try binary search, graph, dynamic programming, O(log n)..."
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-2 text-sm font-semibold">
            Category
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Difficulty
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={difficulty}
              onChange={(event) => {
                setDifficulty(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any difficulty</option>
              {difficulties.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Tags
            <input
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="heap, math, recursion"
              value={tags}
              onChange={(event) => {
                setTags(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Sort
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              {sortOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasFilters && (
          <button
            className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted"
            type="button"
            onClick={clearFilters}
          >
            <XCircle className="h-4 w-4" aria-hidden />
            Clear filters
          </button>
        )}
      </section>

      {query.isLoading && (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      )}

      {query.isError && (
        <Card className="border-accent/50 bg-accent/10">
          <CardTitle>Search failed</CardTitle>
          <CardDescription>{query.error instanceof Error ? query.error.message : "Try adjusting filters."}</CardDescription>
        </Card>
      )}

      {!query.isLoading && !query.isError && result?.items.length === 0 && (
        <Card className="grid gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle>No algorithms matched</CardTitle>
          </div>
          <CardDescription>Try a broader term, remove a tag, or start from one of these categories.</CardDescription>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button
                className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
                key={item.slug}
                type="button"
                onClick={() => setCategory(item.slug)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {!query.isLoading && result?.items.length ? (
        <section className="grid gap-3" aria-label="Search results">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-foreground/70">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Showing {result.items.length} of {result.meta.total} on page {result.meta.page} of {result.meta.total_pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={!result.meta.has_previous}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </button>
              <button
                className="rounded-md border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={!result.meta.has_next}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
          {result.items.map((algorithm) => (
            <Link key={algorithm.id} href={`/algorithms/${algorithm.slug}`}>
              <Card className="transition hover:border-primary hover:bg-muted/50">
                <CardHeader>
                  <div>
                    <CardTitle>{highlight(algorithm.name, debouncedQuery)}</CardTitle>
                    <CardDescription>{highlight(algorithm.description ?? "No description available.", debouncedQuery)}</CardDescription>
                  </div>
                  <Badge tone="muted">{algorithm.difficulty}</Badge>
                </CardHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="default">{algorithm.category_slug.replaceAll("-", " ")}</Badge>
                  {algorithm.tags.slice(0, 5).map((tag) => (
                    <Badge tone="muted" key={tag}>
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function highlight(value: string, q: string) {
  const trimmed = q.trim();
  if (!trimmed) return value;
  const index = value.toLowerCase().indexOf(trimmed.toLowerCase());
  if (index === -1) return value;
  return (
    <>
      {value.slice(0, index)}
      <mark className="bg-accent/25 px-1 text-foreground">{value.slice(index, index + trimmed.length)}</mark>
      {value.slice(index + trimmed.length)}
    </>
  );
}
