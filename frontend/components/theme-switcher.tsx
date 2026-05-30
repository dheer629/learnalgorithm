"use client";

import { Palette } from "lucide-react";
import { useEffect } from "react";
import { usePreferences } from "@/store/preferences";

const themes = [
  { id: "skyline", name: "Skyline" },
  { id: "leetcode", name: "LeetCode" },
  { id: "ocean", name: "Ocean" },
  { id: "mint", name: "Mint" },
  { id: "violet", name: "Violet" },
  { id: "rose", name: "Rose" },
  { id: "graphite", name: "Graphite" },
  { id: "matrix", name: "Matrix" },
  { id: "amber", name: "Amber" },
  { id: "mono", name: "Mono" }
];

export function ThemeSwitcher() {
  const { theme, setTheme } = usePreferences();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("algolearn-theme");
    if (savedTheme && savedTheme !== theme) {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
      return;
    }
    document.documentElement.dataset.theme = theme;
  }, [setTheme, theme]);

  function changeTheme(nextTheme: string) {
    window.localStorage.setItem("algolearn-theme", nextTheme);
    setTheme(nextTheme);
  }

  return (
    <label className="inline-flex h-10 items-center gap-2 border border-border bg-background px-3 text-sm font-medium shadow-sm">
      <Palette className="h-4 w-4 text-primary" aria-hidden />
      <select
        className="bg-transparent text-sm outline-none"
        aria-label="Theme"
        value={theme}
        onChange={(event) => changeTheme(event.target.value)}
      >
        {themes.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
