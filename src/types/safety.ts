export type SafetyStatus = "SAFE" | "WARNING" | "HIGH_RISK";

export type SafeZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type SafetyState = {
  riskScore: number;
  riskLevel: SafetyStatus;
  reasons: string[];
  nearestSafeZone: SafeZone;
  distanceToNearestZoneMeters: number;
  isInsideSafeZone: boolean;
  routeDeviation: boolean;
};

export type SafetyLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  lastUpdated: number;
};

export type SafetyEvent = {
  id: string;
  title: string;
  detail: string;
  time: string;
  status: SafetyStatus;
};

export type AssistantSettings = {
  userName: string;
  name: string;
  voice: "Эмэгтэй" | "Эрэгтэй";
  avatar: "Мило" | "Ари" | "Номи" | "Туяа";
  tone: "Тайван" | "Найрсаг";
  speechSpeed: "Удаан" | "Энгийн";
  instructionLength: "Богино" | "Энгийн";
};

export type CompanionProfile = {
  userName: string;
  assistantName: string;
  voiceId?: string;
  tone: "calm" | "friendly";
  instructionLength: "short" | "normal";
};

export type SafetyAssistantRequest = CompanionProfile & {
  riskLevel: SafetyStatus;
  riskScore: number;
  insideSafeZone: boolean;
  /** null means deviation detected but no measured distance is available; 0 means none. */
  routeDeviationMeters: number | null;
  nearestSafeZone: string;
  distanceFromSafeZone: number;
  destination: string | null;
  navigationInstruction?: string;
};
