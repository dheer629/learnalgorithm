import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const algorithms = await api.algorithms({ category: params.slug });
  return (
    <div className="grid gap-6">
      <nav className="text-sm text-foreground/70">
        <Link href="/" className="underline">
          Home
        </Link>{" "}
        / {params.slug}
      </nav>
      <header className="rounded-lg border border-border bg-panel p-5 shadow-sm">
        <Badge className="mb-3">Category</Badge>
        <h1 className="text-3xl font-bold capitalize tracking-tight">{params.slug.replaceAll("-", " ")}</h1>
        <p className="mt-2 text-sm text-foreground/70">{algorithms.length} algorithms ready to inspect, run, and visualize.</p>
      </header>
      <section className="grid gap-3 md:grid-cols-2">
        {algorithms.map((algorithm) => (
          <Link key={algorithm.id} href={`/algorithms/${algorithm.slug}`}>
            <Card className="h-full transition hover:border-primary hover:bg-muted/50">
              <CardHeader>
                <div>
                  <CardTitle>{algorithm.name}</CardTitle>
                  <CardDescription>{algorithm.description}</CardDescription>
                </div>
                <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge tone="muted">{algorithm.difficulty}</Badge>
                {algorithm.tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} tone="muted">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
