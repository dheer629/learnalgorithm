"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

export function Tabs({
  active,
  items,
  onChange
}: {
  active: string;
  items: TabItem[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-border" role="tablist" aria-label="Algorithm workspace">
      {items.map((item) => (
        <button
          aria-selected={active === item.id}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition",
            active === item.id
              ? "border-primary text-primary"
              : "border-transparent text-foreground/65 hover:text-foreground"
          )}
          key={item.id}
          onClick={() => onChange(item.id)}
          role="tab"
          type="button"
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
