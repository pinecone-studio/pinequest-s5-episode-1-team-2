"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  ASSISTANT_SETTINGS_STORAGE_KEY,
  DEFAULT_ASSISTANT_SETTINGS,
  normalizeAssistantSettings,
} from "@/lib/assistant-settings";
import type { AssistantSettings } from "@/types/safety";

const defaultSnapshot = JSON.stringify(DEFAULT_ASSISTANT_SETTINGS);
const settingsChangedEvent = "safepath-assistant-settings-changed";

export function useAssistantSettings() {
  const snapshot = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(settingsChangedEvent, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(settingsChangedEvent, onChange);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(ASSISTANT_SETTINGS_STORAGE_KEY) ?? defaultSnapshot;
      } catch {
        return defaultSnapshot;
      }
    },
    () => defaultSnapshot,
  );
  const settings = useMemo(() => {
    try {
      return normalizeAssistantSettings(JSON.parse(snapshot));
    } catch {
      return DEFAULT_ASSISTANT_SETTINGS;
    }
  }, [snapshot]);

  const update = useCallback(<K extends keyof AssistantSettings>(key: K, value: AssistantSettings[K]) => {
    try {
      const current = normalizeAssistantSettings(JSON.parse(window.localStorage.getItem(ASSISTANT_SETTINGS_STORAGE_KEY) ?? defaultSnapshot));
      window.localStorage.setItem(ASSISTANT_SETTINGS_STORAGE_KEY, JSON.stringify({ ...current, [key]: value }));
      window.dispatchEvent(new Event(settingsChangedEvent));
    } catch {
      // The built-in profile remains available if local storage is unavailable.
    }
  }, []);

  return { settings, update };
}
