/**
 * Finly Native Desktop Notification System
 * Uses the official Tauri v2 Notification Plugin (@tauri-apps/plugin-notification)
 * https://v2.tauri.app/plugin/notification/
 */

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  onAction,
} from "@tauri-apps/plugin-notification";

// Register action listener on module load so clicking the desktop notification focuses the window
if (typeof window !== "undefined") {
  try {
    onAction(() => {
      window.focus();
    }).catch(() => {});
  } catch {
    // Non-tauri context fallback
  }
}

/**
 * Plays a subtle, pleasant 2-tone melodic chime using Web Audio API.
 * 100% offline, zero external asset dependencies.
 */
export function playCompletionChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.09, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    gainNode.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5

    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + 0.45);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Fail silently if browser audio policies prevent immediate playback
  }
}

/**
 * Requests permission for native OS Desktop Notifications via Tauri plugin.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    return granted;
  } catch (err) {
    console.warn("Could not request Tauri notification permission:", err);
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        return perm === "granted";
      } catch {
        return false;
      }
    }
    return false;
  }
}

export interface DesktopNotificationOptions {
  title?: string;
  body: string;
  playSound?: boolean;
}

/**
 * Sends a native OS desktop notification using Tauri v2 Notification Plugin.
 */
export async function notifyLLMCompletion(options: DesktopNotificationOptions) {
  const title = options.title || "Finly AI";
  const body = options.body;

  // 1. Play audio chime if enabled
  if (options.playSound !== false) {
    playCompletionChime();
  }

  // 2. Dispatch native OS desktop notification via Tauri v2 plugin
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }

    if (granted) {
      sendNotification({
        title,
        body,
      });
      return;
    }
  } catch (pluginErr) {
    console.warn("Tauri sendNotification error, checking Web Notification fallback:", pluginErr);
  }

  // Fallback for standard browser / dev environment
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      } else if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          new Notification(title, { body });
        }
      }
    } catch (fallbackErr) {
      console.warn("Web Notification fallback error:", fallbackErr);
    }
  }
}
