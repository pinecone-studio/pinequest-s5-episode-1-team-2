/** A position described in words, for a guardian who does not want to read a map. */
export type PlaceDescription = {
  /** The nearest named place, e.g. a shop, school or building. */
  place: string | null;
  /** Street and house number. */
  street: string | null;
  /** Neighbourhood or district. */
  area: string | null;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
// Nominatim's usage policy: identify the app and send at most one request per second.
const USER_AGENT = "SafePath/1.0 (family safety app)";
const MIN_GAP_MS = 1_100;
const TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 500;

const cache = new Map<string, { value: PlaceDescription; at: number }>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/**
 * Street-level description of a position, from OpenStreetMap. Positions are rounded to about
 * 11 m before lookup, so a child standing still costs one request, not one per report.
 */
export async function describePosition(latitude: number, longitude: number): Promise<PlaceDescription> {
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  // One request at a time across all guardians on this server, spaced for the usage policy.
  const lookup = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return fetchPlace(key);
  });
  queue = lookup.catch(() => undefined);
  const value = await lookup;

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, at: Date.now() });
  return value;
}

async function fetchPlace(key: string): Promise<PlaceDescription> {
  const [lat, lon] = key.split(",");
  const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=mn`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
  return readPlace(await response.json());
}

function readPlace(value: unknown): PlaceDescription {
  const record = isRecord(value) ? value : {};
  const address = isRecord(record.address) ? record.address : {};
  const text = (input: unknown) => (typeof input === "string" && input.trim() ? input.trim() : null);

  const road = text(address.road) ?? text(address.pedestrian) ?? text(address.footway);
  const houseNumber = text(address.house_number);
  const street = road ? (houseNumber ? `${road} ${houseNumber}` : road) : null;
  // A result named after the road itself adds nothing beyond the street line.
  const name = text(record.name);
  const place = name && name !== road ? name : null;
  const area = [text(address.neighbourhood) ?? text(address.quarter) ?? text(address.suburb), text(address.city_district)]
    .filter((part, index, parts): part is string => part !== null && parts.indexOf(part) === index)
    .join(", ") || null;

  return { place, street, area };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
