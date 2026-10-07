import { getSafeZoneProximities } from "@/lib/geofence";
import { SAFE_ZONES } from "@/lib/safe-zones";
import type { SafeZone, SafetyLocation, SafetyState, SafetyStatus } from "@/types/safety";

export type RiskEngineInput = {
  location: Pick<SafetyLocation, "latitude" | "longitude">;
  safeZones?: SafeZone[];
  routeDeviation?: boolean;
};

export function calculateSafetyState({
  location,
  safeZones = SAFE_ZONES,
  routeDeviation = false,
}: RiskEngineInput): SafetyState {
  const nearest = getSafeZoneProximities(location, safeZones)[0];

  if (!nearest) {
    throw new Error("Risk engine requires at least one safe zone.");
  }

  const { zone, distanceToBoundaryMeters, isInside } = nearest;
  let riskScore = 0;
  const reasons: string[] = [];

  if (isInside) {
    reasons.push(`${zone.name} аюулгүй бүсэд байна`);
  } else {
    riskScore += 20;
    reasons.push("Бүх аюулгүй бүсээс гарсан");

    if (distanceToBoundaryMeters > 300) {
      riskScore += 15;
      reasons.push("Хамгийн ойр бүсээс 300 м-ээс хол");
    }
    if (distanceToBoundaryMeters > 700) {
      riskScore += 20;
      reasons.push("Хамгийн ойр бүсээс 700 м-ээс хол");
    }
    if (distanceToBoundaryMeters > 1_000) {
      riskScore += 20;
      reasons.push("Хамгийн ойр бүсээс 1 км-ээс хол");
    }
  }

  if (routeDeviation) {
    riskScore += 25;
    reasons.push("Маршрутаас хазайсан");
  }

  riskScore = Math.min(100, Math.max(0, riskScore));

  return {
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    reasons,
    nearestSafeZone: zone,
    distanceToNearestZoneMeters: Math.round(distanceToBoundaryMeters),
    isInsideSafeZone: isInside,
    routeDeviation,
  };
}

function getRiskLevel(score: number): SafetyStatus {
  if (score >= 60) return "HIGH_RISK";
  if (score >= 30) return "WARNING";
  return "SAFE";
}
