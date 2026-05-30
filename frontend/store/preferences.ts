"use client";

import { create } from "zustand";

type PreferencesState = {
  codeFontSize: number;
  theme: string;
  bookmarks: string[];
  toggleBookmark: (slug: string) => void;
  setCodeFontSize: (size: number) => void;
  setTheme: (theme: string) => void;
};

export const usePreferences = create<PreferencesState>((set) => ({
  codeFontSize: 14,
  theme: "skyline",
  bookmarks: [],
  toggleBookmark: (slug) =>
    set((state) => ({
      bookmarks: state.bookmarks.includes(slug)
        ? state.bookmarks.filter((item) => item !== slug)
        : [...state.bookmarks, slug]
    })),
  setCodeFontSize: (codeFontSize) => set({ codeFontSize }),
  setTheme: (theme) => set({ theme })
}));
