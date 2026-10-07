import type { SafetyStatus } from "@/types/safety";

const FALLBACK_MESSAGES: Record<SafetyStatus, string> = {
  SAFE: "Таны зам хэвийн байна. Тайван үргэлжлүүлээрэй.",
  WARNING: "Аюулгүй бүсээс гадуур байна. Түр зогсоод чиглэлээ шалгаарай.",
  HIGH_RISK: "Аюулгүй бүсээс хол байна. Түр зогсоод асран хамгаалагчтайгаа холбогдоорой.",
};

export function getSafetyFallback(riskLevel: SafetyStatus, userName?: string) {
  const name = userName?.trim().slice(0, 40);
  return name ? `${name}, ${FALLBACK_MESSAGES[riskLevel]}` : FALLBACK_MESSAGES[riskLevel];
}
