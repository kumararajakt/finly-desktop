import { invoke } from "@tauri-apps/api/core";
import { AIConfig, DEFAULT_AI_CONFIG } from "./types";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function safeGetLocalStorage(key: string): string | null {
  if (typeof localStorage !== "undefined") {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

function safeSetLocalStorage(key: string, value: string): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

/**
 * Loads the user's AI configuration from SQLite setting or local storage.
 */
export async function getAIConfig(): Promise<AIConfig> {
  if (isTauri()) {
    try {
      const json = await invoke<string | null>("get_setting", { key: "ai_config" });
      if (json) {
        const parsed = JSON.parse(json);
        return { ...DEFAULT_AI_CONFIG, ...parsed };
      }
    } catch (err) {
      console.error("Failed to load ai_config from SQLite:", err);
    }
  }

  const local = safeGetLocalStorage("finly_ai_config");
  if (local) {
    try {
      const parsed = JSON.parse(local);
      return { ...DEFAULT_AI_CONFIG, ...parsed };
    } catch {
      // fallback
    }
  }

  return DEFAULT_AI_CONFIG;
}

/**
 * Persists the user's AI configuration to SQLite and local storage.
 */
export async function saveAIConfig(config: AIConfig): Promise<void> {
  const jsonStr = JSON.stringify(config);

  if (isTauri()) {
    try {
      await invoke("set_setting", {
        key: "ai_config",
        value: jsonStr,
      });
      return;
    } catch (err) {
      console.error("Failed to save ai_config to SQLite:", err);
    }
  }

  safeSetLocalStorage("finly_ai_config", jsonStr);
}
