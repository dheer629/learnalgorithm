import Link from "next/link";
import { api } from "@/lib/api";
import { SortingVisualizer } from "@/components/visualizers/sorting-visualizer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const categories = await api.categories();
  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Interactive Algorithms</p>
        <h1 className="max-w-4xl text-4xl font-bold md:text-6xl">Learn, inspect, run, and master Python algorithms.</h1>
        <p className="max-w-3xl text-lg text-foreground/75">
          Browse structured metadata extracted from TheAlgorithms/Python, then move from source code to examples,
          visualizations, and practice without losing context.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="grid min-h-40 gap-3 border border-border p-5 transition-colors hover:bg-muted"
          >
            <span className="text-xl font-semibold">{category.name}</span>
            <span className="text-sm text-foreground/70">{category.description}</span>
            <span className="text-sm font-medium text-primary">{category.algorithm_count} algorithms</span>
          </Link>
        ))}
      </section>
      <SortingVisualizer />
    </div>
  );
}
