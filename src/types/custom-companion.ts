/** The avatar name used when the child builds their own companion instead of picking one. */
export const CUSTOM_AVATAR = "Өөрийн" as const;

export const COMPANION_COLORS = [
  { id: "mint", label: "Гаа", body: "#7dd3c0", shade: "#5bb8a4" },
  { id: "sky", label: "Цэнхэр", body: "#7cb7ff", shade: "#5a98e6" },
  { id: "purple", label: "Ягаан цэнхэр", body: "#b69cff", shade: "#957be6" },
  { id: "pink", label: "Ягаан", body: "#ff9ec7", shade: "#e67fab" },
  { id: "orange", label: "Улбар шар", body: "#ffb26b", shade: "#e6944d" },
  { id: "yellow", label: "Шар", body: "#ffd86b", shade: "#e6bd4d" },
  { id: "green", label: "Ногоон", body: "#8ee07a", shade: "#6fc45c" },
  { id: "gray", label: "Саарал", body: "#b9c2cc", shade: "#98a2ad" },
] as const;

export const COMPANION_EYES = [
  { id: "round", label: "Дугуй" },
  { id: "sparkle", label: "Гялалзсан" },
  { id: "happy", label: "Баяртай" },
  { id: "sleepy", label: "Нойрмог" },
  { id: "star", label: "Од" },
  { id: "wink", label: "Ирмэх" },
] as const;

export const COMPANION_MOUTHS = [
  { id: "smile", label: "Инээмсэглэл" },
  { id: "open", label: "Баяр" },
  { id: "tongue", label: "Хэл" },
  { id: "cat", label: "Муур" },
  { id: "o", label: "Гайхсан" },
] as const;

export const COMPANION_EARS = [
  { id: "none", label: "Байхгүй" },
  { id: "cat", label: "Муур" },
  { id: "bunny", label: "Туулай" },
  { id: "bear", label: "Баавгай" },
  { id: "antenna", label: "Антен" },
  { id: "horns", label: "Эвэр" },
] as const;

export type CompanionColorId = (typeof COMPANION_COLORS)[number]["id"];
export type CompanionEyesId = (typeof COMPANION_EYES)[number]["id"];
export type CompanionMouthId = (typeof COMPANION_MOUTHS)[number]["id"];
export type CompanionEarsId = (typeof COMPANION_EARS)[number]["id"];

/** A companion the child put together from parts. */
export type CustomCompanion = {
  color: CompanionColorId;
  eyes: CompanionEyesId;
  mouth: CompanionMouthId;
  ears: CompanionEarsId;
  cheeks: boolean;
};

export const DEFAULT_CUSTOM_COMPANION: CustomCompanion = {
  color: "mint",
  eyes: "sparkle",
  mouth: "smile",
  ears: "cat",
  cheeks: true,
};

function pick<T extends { id: string }>(options: readonly T[], value: unknown, fallback: T["id"]): T["id"] {
  return options.some((option) => option.id === value) ? (value as T["id"]) : fallback;
}

/** Reads stored parts, falling back to the default for anything missing or unknown. */
export function normalizeCustomCompanion(value: unknown): CustomCompanion {
  const stored = value && typeof value === "object" ? (value as Partial<Record<keyof CustomCompanion, unknown>>) : {};
  return {
    color: pick(COMPANION_COLORS, stored.color, DEFAULT_CUSTOM_COMPANION.color),
    eyes: pick(COMPANION_EYES, stored.eyes, DEFAULT_CUSTOM_COMPANION.eyes),
    mouth: pick(COMPANION_MOUTHS, stored.mouth, DEFAULT_CUSTOM_COMPANION.mouth),
    ears: pick(COMPANION_EARS, stored.ears, DEFAULT_CUSTOM_COMPANION.ears),
    cheeks: typeof stored.cheeks === "boolean" ? stored.cheeks : DEFAULT_CUSTOM_COMPANION.cheeks,
  };
}
