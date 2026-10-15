import type { AssistantSettings, CompanionProfile } from "@/types/safety";
import { isAccessoryId } from "@/types/rewards";
import { DEFAULT_CUSTOM_COMPANION, normalizeCustomCompanion } from "@/types/custom-companion";

export const ASSISTANT_SETTINGS_STORAGE_KEY = "safepath-assistant-settings";

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  userName: "Тэмүүлэн",
  name: "Мило",
  voice: "Эмэгтэй",
  avatar: "Мило",
  tone: "Тайван",
  speechSpeed: "Удаан",
  instructionLength: "Богино",
  accessory: null,
  custom: DEFAULT_CUSTOM_COMPANION,
};

export function normalizeAssistantSettings(value: unknown): AssistantSettings {
  if (!value || typeof value !== "object") return DEFAULT_ASSISTANT_SETTINGS;
  const stored = value as Partial<AssistantSettings>;

  return {
    userName: readText(stored.userName, DEFAULT_ASSISTANT_SETTINGS.userName, 40),
    name: readText(stored.name, DEFAULT_ASSISTANT_SETTINGS.name, 40),
    voice: stored.voice === "Эрэгтэй" ? "Эрэгтэй" : "Эмэгтэй",
    avatar: isAvatar(stored.avatar) ? stored.avatar : DEFAULT_ASSISTANT_SETTINGS.avatar,
    tone: stored.tone === "Найрсаг" ? "Найрсаг" : "Тайван",
    speechSpeed: stored.speechSpeed === "Энгийн" ? "Энгийн" : "Удаан",
    instructionLength: stored.instructionLength === "Энгийн" ? "Энгийн" : "Богино",
    accessory: isAccessoryId(stored.accessory) ? stored.accessory : null,
    custom: normalizeCustomCompanion(stored.custom),
  };
}

export function toCompanionProfile(settings: AssistantSettings): CompanionProfile {
  return {
    userName: settings.userName,
    assistantName: settings.name,
    voice: settings.voice === "Эрэгтэй" ? "male" : "female",
    tone: settings.tone === "Найрсаг" ? "friendly" : "calm",
    instructionLength: settings.instructionLength === "Энгийн" ? "normal" : "short",
  };
}

function readText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const text = value.trim().slice(0, maxLength);
  return text || fallback;
}

function isAvatar(value: unknown): value is AssistantSettings["avatar"] {
  return value === "Мило" || value === "Ари" || value === "Номи" || value === "Туяа" || value === "Мяу" || value === "Бамбар" || value === "Пип" || value === "Рокки" || value === "Өөрийн";
}
