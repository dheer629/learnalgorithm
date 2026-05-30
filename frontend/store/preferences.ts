"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SearchFilters = {
  q: string;
  category: string;
  difficulty: string;
  tags: string;
  sort: string;
};

type PreferencesState = {
  codeFontSize: number;
  theme: string;
  preferredLayout: "tabs" | "split";
  lastSelectedTab: string;
  lastSearchFilters: SearchFilters;
  bookmarks: string[];
  toggleBookmark: (slug: string) => void;
  setCodeFontSize: (size: number) => void;
  setTheme: (theme: string) => void;
  setPreferredLayout: (layout: "tabs" | "split") => void;
  setLastSelectedTab: (tab: string) => void;
  setLastSearchFilters: (filters: SearchFilters) => void;
};

const defaultSearchFilters: SearchFilters = {
  q: "",
  category: "",
  difficulty: "",
  tags: "",
  sort: "name"
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      codeFontSize: 14,
      theme: "skyline",
      preferredLayout: "tabs",
      lastSelectedTab: "overview",
      lastSearchFilters: defaultSearchFilters,
      bookmarks: [],
      toggleBookmark: (slug) =>
        set((state) => ({
          bookmarks: state.bookmarks.includes(slug)
            ? state.bookmarks.filter((item) => item !== slug)
            : [...state.bookmarks, slug]
        })),
      setCodeFontSize: (codeFontSize) => set({ codeFontSize }),
      setTheme: (theme) => set({ theme }),
      setPreferredLayout: (preferredLayout) => set({ preferredLayout }),
      setLastSelectedTab: (lastSelectedTab) => set({ lastSelectedTab }),
      setLastSearchFilters: (lastSearchFilters) => set({ lastSearchFilters })
    }),
    {
      name: "algolearn-preferences",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
