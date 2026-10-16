import { bearingDegrees, distanceMeters, relativeBearing, type Coordinate, type RoutePoint } from "@/lib/route-guidance";
import type { SafeZone } from "@/types/safety";

/**
 * Keeps what the child needs to get home on the phone itself, so guidance carries on with no
 * mobile data: the safe zones, and the last walking route worked out for each of them.
 */

const ZONES_KEY = "safepath:offline-zones";
const ROUTES_KEY = "safepath:offline-routes";
// A saved route is only trusted while the child is still close to it.
const ON_ROUTE_METERS = 80;
// A change of direction this sharp along the route counts as a turn to announce.
const TURN_DEGREES = 35;

export type OfflineRoute = {
  destination: Coordinate;
  route: RoutePoint[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  nextInstruction: string;
  /** True when built on the phone without the internet. */
  offline?: boolean;
};

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: guidance still works online.
  }
}

export function saveOfflineZones(zones: SafeZone[]) {
  write(ZONES_KEY, zones);
}

export function loadOfflineZones(): SafeZone[] | null {
  const zones = read<SafeZone[]>(ZONES_KEY);
  return Array.isArray(zones) && zones.length ? zones : null;
}

export function saveOfflineRoute(zoneId: string, route: OfflineRoute) {
  const routes = read<Record<string, OfflineRoute>>(ROUTES_KEY) ?? {};
  routes[zoneId] = { ...route, offline: false };
  write(ROUTES_KEY, routes);
}

function loadOfflineRoute(zoneId: string): OfflineRoute | null {
  return read<Record<string, OfflineRoute>>(ROUTES_KEY)?.[zoneId] ?? null;
}

function formatMeters(meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} метр`;
  return `${(meters / 1000).toFixed(1)} км`;
}

/** "200 метрийн дараа" / "1.2 км-ийн дараа": the suffix joins a word directly, an abbreviation with a hyphen. */
function formatAfter(meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} метрийн дараа`;
  return `${(meters / 1000).toFixed(1)} км-ийн дараа`;
}

/**
 * Where the child stands along the route: the nearest segment and how far along it, plus the
 * distance off the line. Uses a flat projection, which is accurate at street scale.
 */
function snap(location: Coordinate, route: RoutePoint[]) {
  const metersPerLat = 111_320;
  const metersPerLon = 111_320 * Math.cos((location.latitude * Math.PI) / 180);
  const xy = ([latitude, longitude]: RoutePoint) => ({
    x: (longitude - location.longitude) * metersPerLon,
    y: (latitude - location.latitude) * metersPerLat,
  });
  let best = { segment: 0, t: 0, off: Number.POSITIVE_INFINITY };
  for (let index = 0; index < route.length - 1; index += 1) {
    const a = xy(route[index]);
    const b = xy(route[index + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));
    const off = Math.hypot(a.x + t * dx, a.y + t * dy);
    if (off < best.off) best = { segment: index, t, off };
  }
  return best;
}

const toPoint = ([latitude, longitude]: RoutePoint): Coordinate => ({ latitude, longitude });

/**
 * Next step read from the route's own shape: walk forward from the child and find the first
 * clear change of direction. Returns the spoken instruction and the distance left to walk.
 */
export function instructionFromRoute(location: Coordinate, route: RoutePoint[]): { instruction: string; remaining: number } | null {
  if (route.length < 2) return null;
  const { segment, t } = snap(location, route);
  const start = route[segment];
  const end = route[segment + 1];
  const snapped: Coordinate = {
    latitude: start[0] + (end[0] - start[0]) * t,
    longitude: start[1] + (end[1] - start[1]) * t,
  };

  let walked = distanceMeters(snapped, toPoint(end));
  let heading = bearingDegrees(toPoint(start), toPoint(end));
  let turn: { at: number; side: "left" | "right" } | null = null;
  for (let index = segment + 1; index < route.length - 1; index += 1) {
    const next = bearingDegrees(toPoint(route[index]), toPoint(route[index + 1]));
    const change = relativeBearing(next, heading);
    if (!turn && Math.abs(change) >= TURN_DEGREES) turn = { at: walked, side: change > 0 ? "right" : "left" };
    walked += distanceMeters(toPoint(route[index]), toPoint(route[index + 1]));
    heading = next;
  }

  const remaining = walked;
  if (!turn) return { instruction: `Энэ замаараа чигээрээ яваарай. Очих газар хүртэл ${formatMeters(remaining)} үлдлээ.`, remaining };
  const side = turn.side === "right" ? "баруун" : "зүүн";
  return {
    instruction: turn.at < 15
      ? `Одоо ${side} тийш эргээрэй.`
      : `${formatAfter(turn.at)} ${side} тийш эргээрэй.`,
    remaining,
  };
}

/**
 * Guidance home with no internet. While the child is near the last route saved for this zone,
 * it follows that route, reading turns from its shape; otherwise it points straight at the zone.
 */
export function buildOfflineRoute(location: Coordinate, zone: SafeZone): OfflineRoute {
  const destination = { latitude: zone.latitude, longitude: zone.longitude };
  const saved = loadOfflineRoute(zone.id);
  if (saved && saved.route.length >= 2 && snap(location, saved.route).off <= ON_ROUTE_METERS) {
    const step = instructionFromRoute(location, saved.route);
    if (step) {
      return { ...saved, destination, distanceMeters: Math.round(step.remaining), durationSeconds: null, nextInstruction: step.instruction, offline: true };
    }
  }

  const straight = distanceMeters(location, destination);
  return {
    destination,
    route: [[location.latitude, location.longitude], [zone.latitude, zone.longitude]],
    distanceMeters: Math.round(straight),
    durationSeconds: null,
    nextInstruction: `Интернетгүй байна. ${zone.name} хүртэл шулуунаар ${formatMeters(straight)}. Сумны заасан зүг рүү том замаар алхаарай.`,
    offline: true,
  };
}
