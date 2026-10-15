export type Coordinate = { latitude: number; longitude: number };
export type RoutePoint = [number, number];

const EARTH_RADIUS_METERS = 6_371_000;
/** How far along the route, past the child, the guidance arrow aims. */
export const LOOK_AHEAD_METERS = 25;

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const degrees = (value: number) => (value * 180) / Math.PI;

export function distanceMeters(from: Coordinate, to: Coordinate): number {
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Compass bearing from one point to another, in degrees clockwise from north. */
export function bearingDegrees(from: Coordinate, to: Coordinate): number {
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

/** Turn needed from `heading` to `bearing`: −180 (left) to +180 (right). */
export function relativeBearing(bearing: number, heading: number): number {
  return ((bearing - heading + 540) % 360) - 180;
}

/**
 * The point the arrow should aim at: the child's spot snapped onto the route, then
 * `LOOK_AHEAD_METERS` further along it. Route shapes can have vertices 100 m or more apart on
 * straight streets, so aiming at the nearest vertex could point backwards; walking along the
 * segments always points the way the route goes.
 */
export function pickLookAheadPoint(location: Coordinate, route: RoutePoint[], lookAhead = LOOK_AHEAD_METERS): Coordinate | null {
  if (route.length < 2) return null;

  // A local flat projection (metres east/north of the child) is accurate at street scale.
  const metersPerLat = 111_320;
  const metersPerLon = 111_320 * Math.cos(radians(location.latitude));
  const toXY = ([latitude, longitude]: RoutePoint) => ({
    x: (longitude - location.longitude) * metersPerLon,
    y: (latitude - location.latitude) * metersPerLat,
  });

  let best = { segment: 0, t: 0, distance: Number.POSITIVE_INFINITY };
  for (let index = 0; index < route.length - 1; index += 1) {
    const a = toXY(route[index]);
    const b = toXY(route[index + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));
    const distance = Math.hypot(a.x + t * dx, a.y + t * dy);
    if (distance < best.distance) best = { segment: index, t, distance };
  }

  // Walk forward along the route from the snapped point.
  let remaining = lookAhead;
  for (let index = best.segment; index < route.length - 1; index += 1) {
    const a = toXY(route[index]);
    const b = toXY(route[index + 1]);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const start = index === best.segment ? best.t : 0;
    const available = length * (1 - start);
    if (available >= remaining && length > 0) {
      const t = start + remaining / length;
      const [lat1, lon1] = route[index];
      const [lat2, lon2] = route[index + 1];
      return { latitude: lat1 + (lat2 - lat1) * t, longitude: lon1 + (lon2 - lon1) * t };
    }
    remaining -= available;
  }

  const [latitude, longitude] = route[route.length - 1];
  return { latitude, longitude };
}
