import Link from "next/link";
import { api } from "@/lib/api";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? "";
  const algorithms = q ? await api.algorithms({ q }) : [];
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-bold">Search</h1>
      <p className="text-foreground/70">{algorithms.length} results for {q || "empty query"}</p>
      <section className="grid gap-3">
        {algorithms.map((algorithm) => (
          <Link key={algorithm.id} href={`/algorithms/${algorithm.slug}`} className="border border-border p-4 hover:bg-muted">
            <h2 className="font-semibold">{algorithm.name}</h2>
            <p className="text-sm text-foreground/70">{algorithm.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

