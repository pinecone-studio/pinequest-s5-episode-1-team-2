import type { SafetyStatus } from "@/types/safety";

// Said without the AI, so they are written to sound like the companion, calling the child by name.
const FALLBACK_MESSAGES: Record<SafetyStatus, string> = {
  SAFE: "чи их гоё алхаж байна. Би чамтай хамт байна!",
  WARNING: "түр зогсоод чиглэлээ хамт шалгая. Санаа зовох хэрэггүй.",
  HIGH_RISK: "аюулгүй газар зогсоорой. Би чамд буцахад тусална.",
};

const GAME_FALLBACKS = [
  "замдаа ногоон өнгөтэй гурван зүйл олоорой. Олох болгондоо надад хэлээрэй!",
  "дараагийн мод хүртэл хэдэн алхам болохыг тааж үзээрэй. Тэгээд хамт тоолъё!",
  "хэдэн алхам чимээгүй алхаад ямар чимээ сонссоноо хэлээрэй.",
  "замдаа дугуй хэлбэртэй зүйл хайгаарай. Хэн түрүүлж олох вэ?",
];

export function getSafetyFallback(riskLevel: SafetyStatus, userName?: string) {
  return withName(userName, FALLBACK_MESSAGES[riskLevel]);
}

/** A walking game for when the AI cannot be reached. */
export function getGameFallback(userName?: string) {
  return withName(userName, GAME_FALLBACKS[Math.floor(Math.random() * GAME_FALLBACKS.length)]);
}

function withName(userName: string | undefined, message: string) {
  const name = userName?.trim().slice(0, 40);
  return name ? `${name}, ${message}` : message.charAt(0).toLocaleUpperCase("mn") + message.slice(1);
}
