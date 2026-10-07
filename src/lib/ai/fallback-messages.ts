import type { SafetyStatus } from "@/types/safety";

const FALLBACK_MESSAGES: Record<SafetyStatus, string> = {
  SAFE: "Бүх зүйл хэвийн байна.",
  WARNING: "түр зогсоод чиглэлээ шалгая.",
  HIGH_RISK: "би чамд буцахад тусалъя.",
};

export function getSafetyFallback(riskLevel: SafetyStatus, userName?: string) {
  const name = userName?.trim().slice(0, 40);
  if (riskLevel === "SAFE") return FALLBACK_MESSAGES.SAFE;
  return name ? `${name}, ${FALLBACK_MESSAGES[riskLevel]}` : FALLBACK_MESSAGES[riskLevel];
}
