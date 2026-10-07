import type { SafeZone } from "@/types/safety";

export const SAFE_ZONES: SafeZone[] = [
  {
    id: "home",
    name: "Гэр",
    latitude: 47.9189,
    longitude: 106.9176,
    radiusMeters: 150,
  },
  {
    id: "school",
    name: "Сургууль",
    latitude: 47.9264,
    longitude: 106.9176,
    radiusMeters: 180,
  },
];
