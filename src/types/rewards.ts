import type { AssistantSettings } from "@/types/safety";

/** Companions every child has from the start. */
export const FREE_COMPANIONS = ["Мило", "Ари", "Номи", "Туяа"] as const satisfies readonly AssistantSettings["avatar"][];

/** Companions a child collects by reaching a checkpoint their guardian set. */
export const REWARD_COMPANIONS = ["Мяу", "Бамбар", "Пип", "Рокки"] as const satisfies readonly AssistantSettings["avatar"][];

/** Things a child can put on their companion once earned. */
export const ACCESSORIES = [
  { id: "crown", label: "Титэм", icon: "👑" },
  { id: "hat", label: "Малгай", icon: "🎩" },
  { id: "glasses", label: "Нүдний шил", icon: "🕶️" },
  { id: "bow", label: "Бант", icon: "🎀" },
  { id: "star", label: "Од", icon: "⭐" },
  { id: "rainbow", label: "Солонго", icon: "🌈" },
] as const;

export type AccessoryId = (typeof ACCESSORIES)[number]["id"];

export const REWARD_IDS = [...REWARD_COMPANIONS, ...ACCESSORIES.map((accessory) => accessory.id)] as const;

/** A reward a guardian can attach to a checkpoint: a companion's name or an accessory id. */
export type RewardId = (typeof REWARD_COMPANIONS)[number] | AccessoryId;

export function isRewardId(value: unknown): value is RewardId {
  return typeof value === "string" && (REWARD_IDS as readonly string[]).includes(value);
}

export function isAccessoryId(value: unknown): value is AccessoryId {
  return typeof value === "string" && ACCESSORIES.some((accessory) => accessory.id === value);
}

/** How a reward is shown: its name, and an emoji for accessories. */
export function describeReward(reward: RewardId): { label: string; icon: string | null; companion: boolean } {
  const accessory = ACCESSORIES.find((item) => item.id === reward);
  return accessory
    ? { label: accessory.label, icon: accessory.icon, companion: false }
    : { label: reward, icon: null, companion: true };
}

/**
 * Whether a companion or accessory is still locked for this account. `rewards` is null while
 * unknown, which keeps rewards locked; `isChild` false (a guardian) opens everything.
 */
export function isRewardLocked(id: string, rewards: readonly string[] | null, isChild: boolean | null) {
  if (isChild === false || !(REWARD_IDS as readonly string[]).includes(id)) return false;
  return !rewards?.includes(id);
}

/** The companion actually shown: a reward companion only once it has been earned. */
export function effectiveAvatar(avatar: AssistantSettings["avatar"], unlocked: readonly string[] | null): AssistantSettings["avatar"] {
  if (unlocked === null) return avatar;
  return (REWARD_COMPANIONS as readonly string[]).includes(avatar) && !unlocked.includes(avatar) ? "Мило" : avatar;
}
