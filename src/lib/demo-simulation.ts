import type { SafetyLocation } from "@/types/safety";

export type DemoSafetyScenario = "safe" | "outside" | "high-risk" | "route-deviation";

type ScenarioDefinition = {
  label: string;
  latitude: number;
  longitude: number;
  routeDeviation: boolean;
};

export const DEMO_SAFETY_SCENARIOS: Record<DemoSafetyScenario, ScenarioDefinition> = {
  safe: {
    label: "Аюулгүй",
    latitude: 47.9189,
    longitude: 106.9176,
    routeDeviation: false,
  },
  outside: {
    label: "Бүсээс гадуур",
    latitude: 47.9131,
    longitude: 106.9176,
    routeDeviation: false,
  },
  "high-risk": {
    label: "Өндөр эрсдэл",
    latitude: 47.89,
    longitude: 106.9176,
    routeDeviation: false,
  },
  "route-deviation": {
    label: "Маршрутаас хазайх",
    latitude: 47.9131,
    longitude: 106.9176,
    routeDeviation: true,
  },
};

export function getDemoSafetyLocation(scenario: DemoSafetyScenario): SafetyLocation {
  const { latitude, longitude } = DEMO_SAFETY_SCENARIOS[scenario];

  return {
    latitude,
    longitude,
    accuracy: 20,
    lastUpdated: Date.now(),
  };
}

export function isDemoRouteDeviation(scenario: DemoSafetyScenario) {
  return DEMO_SAFETY_SCENARIOS[scenario].routeDeviation;
}
