import type { SafetyStatus } from "@/types/safety";

// Said without the AI, so they are written to sound like the companion, calling the child by name.
const FALLBACK_MESSAGES: Record<SafetyStatus, string> = {
  SAFE: "чи их гоё алхаж байна. Би чамтай хамт байна!",
  WARNING: "түр зогсоод чиглэлээ хамт шалгая. Санаа зовох хэрэггүй.",
  HIGH_RISK: "аюулгүй газар зогсоорой. Би чамд буцахад тусална.",
};

export function getSafetyFallback(riskLevel: SafetyStatus, userName?: string) {
  return withName(userName, FALLBACK_MESSAGES[riskLevel]);
}

function withName(userName: string | undefined, message: string) {
  const name = userName?.trim().slice(0, 40);
  return name ? `${name}, ${message}` : message.charAt(0).toLocaleUpperCase("mn") + message.slice(1);
}
