import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "muted" | "success" | "warning" | "danger";
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wide",
        tone === "default" && "border-primary/30 bg-primary/10 text-primary",
        tone === "muted" && "border-border bg-muted text-foreground/70",
        tone === "success" && "border-primary/30 bg-primary/10 text-primary",
        tone === "warning" && "border-accent/40 bg-accent/10 text-accent",
        tone === "danger" && "border-accent/50 bg-accent/15 text-accent",
        className
      )}
      {...props}
    />
  );
}
