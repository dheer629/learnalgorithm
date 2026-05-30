import Link from "next/link";
import { ArrowRight, Binary, BrainCircuit, GitBranch, ListOrdered, Play, Search, Sigma, TextCursorInput } from "lucide-react";
import { RecentlyViewed } from "@/components/recently-viewed";
import { api } from "@/lib/api";
import { SortingVisualizer } from "@/components/visualizers/sorting-visualizer";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const learningPaths = [
  { title: "Sorting", slug: "sorts", icon: ListOrdered, note: "Compare, swap, and reason about order." },
  { title: "Graphs", slug: "graphs", icon: GitBranch, note: "Traverse relationships and shortest paths." },
  { title: "Dynamic Programming", slug: "dynamic-programming", icon: BrainCircuit, note: "Break overlapping choices into state." },
  { title: "Strings", slug: "strings", icon: TextCursorInput, note: "Search, match, transform, and parse text." },
  { title: "Math", slug: "maths", icon: Sigma, note: "Number theory, combinatorics, and formulas." }
];

export default async function HomePage() {
  const categories = await api.categories();
  const recommended = await api.algorithms({ pageSize: 6, sort: "name" });
  return (
    <div className="grid gap-10">
      <section className="grid min-h-[420px] content-center gap-6 rounded-lg border border-border bg-panel/95 p-6 shadow-sm md:p-10">
        <div className="grid gap-4">
          <Badge className="w-fit">Interactive Algorithms</Badge>
          <h1 className="max-w-5xl text-4xl font-bold tracking-tight md:text-6xl">
            Learn, inspect, run, and visualize Python algorithms in one focused workspace.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-foreground/75">
            Browse structured metadata from TheAlgorithms/Python, open runnable examples, inspect execution traces,
            and connect code behavior to the complexity notes you need for interviews and production work.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/search"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:brightness-95"
          >
            <Search className="h-4 w-4" aria-hidden />
            Browse algorithms
          </Link>
          <Link
            href={recommended[0] ? `/algorithms/${recommended[0].slug}` : "/search"}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
          >
            <Play className="h-4 w-4" aria-hidden />
            Run an example
          </Link>
        </div>
        <div className="grid gap-3 border-t border-border pt-5 sm:grid-cols-4">
          {["Learn", "Inspect", "Run", "Visualize"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm font-semibold text-foreground/75">
              <Binary className="h-4 w-4 text-primary" aria-hidden />
              {item}
            </div>
          ))}
        </div>
      </section>

      <RecentlyViewed />

      <section className="grid gap-4" aria-labelledby="paths-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="paths-heading" className="text-2xl font-semibold">
              Learning Paths
            </h2>
            <p className="text-sm text-foreground/70">Start with a pattern, then move into concrete source code.</p>
          </div>
          <Link href="/search" className="hidden items-center gap-1 text-sm font-semibold text-primary md:inline-flex">
            All paths <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {learningPaths.map((path) => {
            const Icon = path.icon;
            return (
              <Link key={path.slug} href={`/categories/${path.slug}`}>
                <Card className="h-full transition hover:border-primary hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle>{path.title}</CardTitle>
                    <Icon className="h-5 w-5 text-primary" aria-hidden />
                  </CardHeader>
                  <CardDescription>{path.note}</CardDescription>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="categories-heading">
        <div>
          <h2 id="categories-heading" className="text-2xl font-semibold">
            Algorithm Library
          </h2>
          <p className="text-sm text-foreground/70">Choose a category, scan difficulty, then open a workspace.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="grid min-h-40 gap-3 rounded-lg border border-border bg-panel p-5 shadow-sm transition-colors hover:border-primary hover:bg-muted/50"
          >
            <span className="flex items-center justify-between gap-3 text-xl font-semibold">
              {category.name}
              <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <span className="text-sm text-foreground/70">{category.description}</span>
            <span className="text-sm font-semibold text-primary">{category.algorithm_count} algorithms</span>
          </Link>
        ))}
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby="recommended-heading">
        <h2 id="recommended-heading" className="text-2xl font-semibold">
          Recommended Starters
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recommended.map((algorithm) => (
            <Link key={algorithm.id} href={`/algorithms/${algorithm.slug}`}>
              <Card className="h-full transition hover:border-primary hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{algorithm.name}</CardTitle>
                  <Badge tone="muted">{algorithm.difficulty}</Badge>
                </CardHeader>
                <CardDescription>{algorithm.description}</CardDescription>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <SortingVisualizer />
    </div>
  );
}
