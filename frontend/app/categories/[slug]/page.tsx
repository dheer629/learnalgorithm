import Link from "next/link";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const algorithms = await api.algorithms({ category: params.slug });
  return (
    <div className="grid gap-6">
      <nav className="text-sm text-foreground/70">
        <Link href="/" className="underline">Home</Link> / {params.slug}
      </nav>
      <h1 className="text-3xl font-bold">{params.slug.replaceAll("-", " ")}</h1>
      <section className="grid gap-3">
        {algorithms.map((algorithm) => (
          <Link key={algorithm.id} href={`/algorithms/${algorithm.slug}`} className="grid gap-2 border border-border p-4 hover:bg-muted">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{algorithm.name}</h2>
              <span className="border border-border px-2 py-1 text-xs">{algorithm.difficulty}</span>
            </div>
            <p className="line-clamp-2 text-sm text-foreground/70">{algorithm.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
