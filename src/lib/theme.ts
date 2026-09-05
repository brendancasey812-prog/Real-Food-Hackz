"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

/** localStorage key. The inline script in the layout reads this too, so the
 *  first paint already has the right theme — no white flash on a dark setup. */
export const THEME_KEY = "rfh-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** What "system" currently resolves to. */
export function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") return prefersDark() ? "dark" : "light";
  return theme;
}

/** Paint the choice onto <html>; every token in globals.css hangs off this. */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const dark = resolveTheme(theme) === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * Theme lives in its own tiny store rather than in the synced AppData: it is a
 * per-device preference, and a phone shouldn't flip to a laptop's setting.
 */
export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      }
    }),
    {
      name: THEME_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      }
    },
  ),
);

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Keeps <html> in step with the stored choice, and follows the OS while on
 *  "system". Mounted once, in the root layout. */
export function ThemeSync() {
  const theme = useTheme((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return null;
}
