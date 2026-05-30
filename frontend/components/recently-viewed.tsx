"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type RecentItem = {
  name: string;
  slug: string;
  category: string;
};

export function RecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("algolearn-recent");
      setItems(stored ? JSON.parse(stored).slice(0, 4) : []);
    } catch {
      setItems([]);
    }
  }, []);

  if (!items.length) return null;

  return (
    <section className="grid gap-3" aria-labelledby="recent-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-heading" className="text-2xl font-semibold">
          Recently Viewed
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Link key={item.slug} href={`/algorithms/${item.slug}`}>
            <Card className="h-full transition hover:border-primary hover:bg-muted/50">
              <CardTitle>{item.name}</CardTitle>
              <CardDescription>{item.category.replaceAll("-", " ")}</CardDescription>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
