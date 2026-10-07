import type { SafeZone, SafetyLocation } from "@/types/safety";

export type SafeZoneProximity = {
  zone: SafeZone;
  distanceMeters: number;
  distanceToBoundaryMeters: number;
  isInside: boolean;
};

export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(lat2 - lat1);
  const longitudeDelta = toRadians(lng2 - lng1);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

export function getSafeZoneProximities(
  location: Pick<SafetyLocation, "latitude" | "longitude">,
  safeZones: SafeZone[],
): SafeZoneProximity[] {
  return safeZones
    .map((zone) => {
      const distanceMeters = getDistanceMeters(
        location.latitude,
        location.longitude,
        zone.latitude,
        zone.longitude,
      );
      const distanceToBoundaryMeters = Math.max(0, distanceMeters - zone.radiusMeters);

      return {
        zone,
        distanceMeters,
        distanceToBoundaryMeters,
        isInside: distanceMeters <= zone.radiusMeters,
      };
    })
    .sort((a, b) => {
      if (a.isInside !== b.isInside) return a.isInside ? -1 : 1;
      return a.distanceToBoundaryMeters - b.distanceToBoundaryMeters;
    });
}

export function detectSafeZones(
  location: Pick<SafetyLocation, "latitude" | "longitude">,
  safeZones: SafeZone[],
) {
  return getSafeZoneProximities(location, safeZones).map(({ zone, isInside }) => ({
    zone,
    isInside,
  }));
}
