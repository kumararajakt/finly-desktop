import { invoke } from "@tauri-apps/api/core";
import { ThemeMode } from "../types/finance";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // Clean up any previous listener
  if (mediaListener) {
    mediaQuery.removeEventListener("change", mediaListener);
    mediaListener = null;
  }

  if (mode === "dark") {
    root.classList.add("dark");
  } else if (mode === "light") {
    root.classList.remove("dark");
  } else {
    // "auto" mode: follow OS system preference
    if (mediaQuery.matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    mediaListener = (e: MediaQueryListEvent) => {
      if (e.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };
    mediaQuery.addEventListener("change", mediaListener);
  }
}

export async function getStoredTheme(): Promise<ThemeMode> {
  if (isTauri()) {
    try {
      const mode = await invoke<string | null>("get_setting", { key: "theme" });
      if (mode === "light" || mode === "dark" || mode === "auto") {
        return mode;
      }
    } catch (err) {
      console.error("Failed to fetch theme from SQLite:", err);
    }
  }

  const local = localStorage.getItem("finly_theme");
  if (local === "light" || local === "dark" || local === "auto") {
    return local;
  }
  return "auto";
}

export async function setStoredTheme(mode: ThemeMode): Promise<void> {
  applyTheme(mode);

  if (isTauri()) {
    try {
      await invoke("set_setting", { key: "theme", value: mode });
      return;
    } catch (err) {
      console.error("Failed to save theme in SQLite:", err);
    }
  }

  localStorage.setItem("finly_theme", mode);
}
