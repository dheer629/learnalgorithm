"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type RecentItem = {
  name: string;
  slug: string;
  category: string;
};

const RECENT_KEY = "algolearn-recent";
const RECENT_UPDATED_EVENT = "algolearn-recent-updated";

export function RecentlyViewed() {
  const snapshot = useSyncExternalStore(subscribeRecentStore, getRecentSnapshot, getServerSnapshot);
  const items = useMemo(() => parseRecentItems(snapshot), [snapshot]);

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

function subscribeRecentStore(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  function handleStorage(event: StorageEvent) {
    if (event.key === RECENT_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(RECENT_UPDATED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(RECENT_UPDATED_EVENT, onStoreChange);
  };
}

function getRecentSnapshot() {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(RECENT_KEY) ?? "[]";
}

function getServerSnapshot() {
  return "[]";
}

function parseRecentItems(snapshot: string): RecentItem[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentItem).slice(0, 4);
  } catch {
    return [];
  }
}

function isRecentItem(value: unknown): value is RecentItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "slug" in value &&
    "category" in value &&
    typeof value.name === "string" &&
    typeof value.slug === "string" &&
    typeof value.category === "string"
  );
}
