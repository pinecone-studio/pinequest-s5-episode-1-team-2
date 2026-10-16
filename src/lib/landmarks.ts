import "server-only";

/** A named place near the person that the companion can point at instead of quoting metres. */
export type Landmark = { name: string; type: string; distance: number };

type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// The main Overpass server often answers 429/504 under load and then succeeds on a second try,
// so it is asked twice before falling back to a mirror.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const SEARCH_RADIUS_METERS = 150;
const MAX_LANDMARKS = 8;
// Overpass is a shared free service: reuse one answer per ~100 m cell for a few minutes.
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; places: { name: string; type: string; lat: number; lon: number }[] }>();

// Mongolian words a child or an older person would use for each kind of place.
const AMENITY_TYPES: Record<string, string> = {
  school: "сургууль",
  kindergarten: "цэцэрлэг",
  university: "их сургууль",
  college: "коллеж",
  hospital: "эмнэлэг",
  clinic: "эмнэлэг",
  doctors: "эмнэлэг",
  pharmacy: "эмийн сан",
  bank: "банк",
  cafe: "кафе",
  restaurant: "хоолны газар",
  fast_food: "хоолны газар",
  fuel: "шатахуун түгээх станц",
  police: "цагдаагийн газар",
  post_office: "шуудан",
  library: "номын сан",
  place_of_worship: "сүм",
  theatre: "театр",
  cinema: "кино театр",
  marketplace: "зах",
};
const SHOP_TYPES: Record<string, string> = {
  supermarket: "супермаркет",
  department_store: "их дэлгүүр",
  mall: "худалдааны төв",
};
const LEISURE_TYPES: Record<string, string> = {
  park: "цэцэрлэгт хүрээлэн",
  playground: "тоглоомын талбай",
  sports_centre: "спорт төв",
  stadium: "цэнгэлдэх хүрээлэн",
};
const TOURISM_TYPES: Record<string, string> = {
  museum: "музей",
  hotel: "зочид буудал",
  attraction: "үзвэр",
};
// Easy to spot from the street, so they win over a closer but obscure place.
const EASY_TO_SPOT = new Set(["сургууль", "цэцэрлэг", "эмнэлэг", "эмийн сан", "супермаркет", "их дэлгүүр", "худалдааны төв", "автобусны буудал", "гэрлэн дохио", "цэцэрлэгт хүрээлэн", "тоглоомын талбай", "номын сан"]);

function describe(tags: Record<string, string>): { name: string; type: string } | null {
  if (tags.highway === "traffic_signals") return { name: "Гэрлэн дохио", type: "гэрлэн дохио" };
  const name = (tags["name:mn"] ?? tags.name)?.trim();
  if (!name) return null;
  if (tags.highway === "bus_stop" || tags.public_transport === "platform") return { name, type: "автобусны буудал" };
  if (tags.amenity) return AMENITY_TYPES[tags.amenity] ? { name, type: AMENITY_TYPES[tags.amenity] } : null;
  if (tags.shop) return { name, type: SHOP_TYPES[tags.shop] ?? "дэлгүүр" };
  if (tags.leisure) return LEISURE_TYPES[tags.leisure] ? { name, type: LEISURE_TYPES[tags.leisure] } : null;
  if (tags.tourism) return TOURISM_TYPES[tags.tourism] ? { name, type: TOURISM_TYPES[tags.tourism] } : null;
  if (tags.building) return { name, type: "барилга" };
  return null;
}

function metersBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadPlaces(latitude: number, longitude: number) {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.places;

  const around = `around:${SEARCH_RADIUS_METERS},${latitude},${longitude}`;
  const query = `[out:json][timeout:8];(
    node(${around})[name][~"^(amenity|shop|tourism|leisure|public_transport|highway)$"~"."];
    way(${around})[name][~"^(amenity|shop|tourism|leisure|building)$"~"."];
    node(${around})[highway=traffic_signals];
  );out center 60;`;
  let data: { elements?: OverpassElement[] } | null = null;
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "SafePath/1.0" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(6_000),
        cache: "no-store",
      });
      if (!response.ok) continue;
      data = (await response.json()) as { elements?: OverpassElement[] };
      break;
    } catch {
      // Timed out or unreachable: try the next server.
    }
  }
  if (!data) throw new Error("No Overpass server answered.");

  const places = (data.elements ?? []).flatMap((element) => {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const place = element.tags ? describe(element.tags) : null;
    return place && lat !== undefined && lon !== undefined ? [{ ...place, lat, lon }] : [];
  });
  cache.set(key, { at: Date.now(), places });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return places;
}

/**
 * Up to eight named places within ~150 m, easiest-to-spot and nearest first. Never throws: when
 * the map service is down the companion simply falls back to plain directions.
 */
export async function findNearbyLandmarks(latitude: number, longitude: number): Promise<Landmark[]> {
  try {
    const places = await loadPlaces(latitude, longitude);
    const seen = new Set<string>();
    return places
      .map((place) => ({
        name: place.name.slice(0, 100),
        type: place.type,
        distance: Math.round(metersBetween(latitude, longitude, place.lat, place.lon)),
      }))
      .filter((place) => place.distance <= SEARCH_RADIUS_METERS)
      .sort((a, b) => a.distance * (EASY_TO_SPOT.has(a.type) ? 0.6 : 1) - b.distance * (EASY_TO_SPOT.has(b.type) ? 0.6 : 1))
      .filter((place) => (seen.has(place.name) ? false : (seen.add(place.name), true)))
      .slice(0, MAX_LANDMARKS);
  } catch {
    return [];
  }
}
