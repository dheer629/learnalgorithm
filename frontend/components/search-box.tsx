"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function SearchBox() {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        setValue("");
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <form
      className="relative w-full min-w-0 md:w-[420px]"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(`/search?q=${encodeURIComponent(value)}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-foreground/60" aria-hidden />
      <input
        aria-label="Search algorithms"
        className="h-10 w-full rounded-md border border-border bg-background pl-10 pr-14 text-sm shadow-sm"
        placeholder="Search algorithms, categories, complexity..."
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <kbd className="pointer-events-none absolute right-3 top-2.5 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/60 md:block">
        /
      </kbd>
    </form>
  );
}
