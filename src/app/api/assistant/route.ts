import { GoogleGenAI } from "@google/genai";
import { getSessionUserId } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import {
  createSafetyPrompt,
  createWalkingGamePrompt,
  SAFETY_ASSISTANT_SYSTEM_PROMPT,
  WALKING_GAME_KINDS,
  WALKING_GAME_SYSTEM_PROMPT,
} from "@/lib/ai/safety-prompt";
import { getGameFallback, getSafetyFallback } from "@/lib/ai/fallback-messages";
import { tidyMongolianText } from "@/lib/ai/mongolian-text";
import type { SafetyAssistantRequest, SafetyStatus } from "@/types/safety";

export const runtime = "nodejs";

const allowedKeys = new Set([
  "riskLevel",
  "riskScore",
  "insideSafeZone",
  "routeDeviationMeters",
  "nearestSafeZone",
  "distanceFromSafeZone",
  "destination",
  "userName",
  "assistantName",
  "voice",
  "tone",
  "instructionLength",
  "navigationInstruction",
  "nearbyLandmarks",
  "mode",
]);
const requiredKeys = [...allowedKeys].filter((key) => key !== "navigationInstruction" && key !== "mode");

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await allowAttempt(`api:${userId}`, 60, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = validateRequest(body);
  if (!input) {
    return Response.json({ error: "Invalid assistant request." }, { status: 400 });
  }

  // Games are only for calm moments: a warning or risk always gets safety guidance instead.
  const game = input.mode === "game" && input.riskLevel === "SAFE";
  const fallback = game ? getGameFallback(input.userName) : getSafetyFallback(input.riskLevel, input.userName);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ message: fallback, fallback: true });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const gameKind = WALKING_GAME_KINDS[Math.floor(Math.random() * WALKING_GAME_KINDS.length)];
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
      contents: game ? createWalkingGamePrompt(input, gameKind) : createSafetyPrompt(input),
      config: {
        systemInstruction: game ? WALKING_GAME_SYSTEM_PROMPT : SAFETY_ASSISTANT_SYSTEM_PROMPT,
        // Some variety keeps a calm walk from sounding scripted; risk guidance stays steady.
        temperature: game ? 0.9 : input.riskLevel === "SAFE" ? 0.5 : 0.3,
        maxOutputTokens: game ? 120 : input.instructionLength === "short" ? 80 : 120,
      },
    });

    const message = normalizeModelMessage(response.text);
    if (!message) return Response.json({ message: fallback, fallback: true });
    return Response.json({ message, fallback: false });
  } catch {
    return Response.json({ message: fallback, fallback: true });
  }
}

function validateRequest(value: unknown): SafetyAssistantRequest | null {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !allowedKeys.has(key)) ||
    requiredKeys.some((key) => !Object.hasOwn(value, key))
  ) return null;

  const riskLevel = value.riskLevel;
  const riskScore = value.riskScore;
  const expectedLevel = isRiskScore(riskScore) ? getRiskLevel(riskScore) : null;
  if (
    !isSafetyStatus(riskLevel) ||
    !isRiskScore(riskScore) ||
    expectedLevel !== riskLevel ||
    typeof value.insideSafeZone !== "boolean" ||
    !isOptionalDistance(value.routeDeviationMeters) ||
    !isText(value.nearestSafeZone, 80) ||
    !isDistance(value.distanceFromSafeZone) ||
    !isOptionalText(value.destination, 120) ||
    !isText(value.userName, 40) ||
    !isText(value.assistantName, 40) ||
    (value.voice !== "female" && value.voice !== "male") ||
    (value.tone !== "calm" && value.tone !== "friendly") ||
    (value.instructionLength !== "short" && value.instructionLength !== "normal") ||
    !isOptionalText(value.navigationInstruction, 160) ||
    (value.mode !== undefined && value.mode !== "guide" && value.mode !== "game") ||
    !isNearbyLandmarks(value.nearbyLandmarks)
  ) {
    return null;
  }

  return {
    riskLevel,
    riskScore,
    insideSafeZone: value.insideSafeZone,
    routeDeviationMeters: value.routeDeviationMeters,
    nearestSafeZone: value.nearestSafeZone.trim(),
    distanceFromSafeZone: value.distanceFromSafeZone,
    destination: typeof value.destination === "string" ? value.destination.trim() : null,
    userName: value.userName.trim(),
    assistantName: value.assistantName.trim(),
    voice: value.voice,
    tone: value.tone,
    instructionLength: value.instructionLength,
    // Without this the model never saw the turn it was meant to say, and fell back to vague distances.
    ...(typeof value.navigationInstruction === "string" && value.navigationInstruction.trim()
      ? { navigationInstruction: value.navigationInstruction.trim() }
      : {}),
    ...(value.mode === "game" ? { mode: "game" as const } : {}),
    ...(Array.isArray(value.nearbyLandmarks)
  ? { nearbyLandmarks: value.nearbyLandmarks }
  : {}),
  };
}

function normalizeModelMessage(value: string | undefined) {
  const message = value ? tidyMongolianText(value) : undefined;
  const sentenceCount = message?.split(/[.!?]+/u).filter((sentence) => sentence.trim()).length ?? 0;
  if (
    !message ||
    message.length > 240 ||
    sentenceCount > 2 ||
    !/\p{Script=Cyrillic}/u.test(message) ||
    /[A-Za-z]{3,}/u.test(message)
  ) {
    return null;
  }
  return message;
}

function getRiskLevel(score: unknown): SafetyStatus | null {
  if (!isRiskScore(score)) return null;
  if (score >= 60) return "HIGH_RISK";
  if (score >= 30) return "WARNING";
  return "SAFE";
}

function isRiskScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafetyStatus(value: unknown): value is SafetyStatus {
  return value === "SAFE" || value === "WARNING" || value === "HIGH_RISK";
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isOptionalText(value: unknown, maxLength: number): value is string | null | undefined {
  return value == null || (typeof value === "string" && value.length <= maxLength);
}

function isDistance(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100_000;
}

function isOptionalDistance(value: unknown): value is number | null {
  return value === null || isDistance(value);
}
function isNearbyLandmarks(
  value: unknown,
): boolean {
  if (value == null) return true;

  if (!Array.isArray(value)) {
    return false;
  }

  if (value.length > 10) {
    return false;
  }

  return value.every((item) => {
    if (!isRecord(item)) {
      return false;
    }

    return (
      isText(item.name, 100) &&
      isText(item.type, 40) &&
      isDistance(item.distance)
    );
  });
}
