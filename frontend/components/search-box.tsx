"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox() {
  const [value, setValue] = useState("");
  const router = useRouter();
  return (
    <form
      className="relative w-full max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(`/search?q=${encodeURIComponent(value)}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-foreground/60" aria-hidden />
      <input
        aria-label="Search algorithms"
        className="h-10 w-full border border-border bg-background pl-10 pr-4 text-sm"
        placeholder="Search algorithms, categories, complexity..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </form>
  );
}

