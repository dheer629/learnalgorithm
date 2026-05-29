"use client";

import { create } from "zustand";

type PreferencesState = {
  codeFontSize: number;
  bookmarks: string[];
  toggleBookmark: (slug: string) => void;
  setCodeFontSize: (size: number) => void;
};

export const usePreferences = create<PreferencesState>((set) => ({
  codeFontSize: 14,
  bookmarks: [],
  toggleBookmark: (slug) =>
    set((state) => ({
      bookmarks: state.bookmarks.includes(slug)
        ? state.bookmarks.filter((item) => item !== slug)
        : [...state.bookmarks, slug]
    })),
  setCodeFontSize: (codeFontSize) => set({ codeFontSize })
}));

