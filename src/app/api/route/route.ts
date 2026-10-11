import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Coordinates = { lat: number; lon: number };

type ValhallaManeuver = {
  instruction?: string;
  type?: number;
  length?: number;
  time?: number;
};

const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const origin = readCoordinates(body?.origin);
    const destination = readCoordinates(body?.destination);

    if (!origin || !destination) {
      return NextResponse.json({ error: "Invalid route coordinates." }, { status: 400 });
    }

    const response = await fetch(VALHALLA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        locations: [origin, destination],
        costing: "pedestrian",
        units: "kilometers",
        directions_options: { units: "kilometers", language: "en-US" },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Route service unavailable." }, { status: 502 });
    }

    const data = await response.json();
    const leg = data?.trip?.legs?.[0];
    if (!leg?.shape || !Array.isArray(leg?.maneuvers)) {
      return NextResponse.json({ error: "No walking route found." }, { status: 404 });
    }

    const route = decodePolyline6(leg.shape);
    const next = pickNextManeuver(leg.maneuvers);
    const distanceMeters = Number.isFinite(next?.length) ? Math.max(0, Math.round(next!.length! * 1000)) : null;

    return NextResponse.json({
      destination: { latitude: destination.lat, longitude: destination.lon },
      route,
      distanceMeters: Number.isFinite(data?.trip?.summary?.length)
        ? Math.round(data.trip.summary.length * 1000)
        : null,
      durationSeconds: Number.isFinite(data?.trip?.summary?.time)
        ? Math.round(data.trip.summary.time)
        : null,
      nextInstruction: next ? buildMongolianInstruction(next, distanceMeters) : "Гэр лүү чигээрээ яв.",
      rawInstruction: next?.instruction ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Route calculation failed." }, { status: 500 });
  }
}

function readCoordinates(value: unknown): Coordinates | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const lat = record.lat;
  const lon = record.lon;
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) return null;
  return { lat, lon };
}

function pickNextManeuver(maneuvers: ValhallaManeuver[]) {
  return maneuvers.find((maneuver) => maneuver.type !== 1 && typeof maneuver.instruction === "string")
    ?? maneuvers.find((maneuver) => typeof maneuver.instruction === "string")
    ?? null;
}

function buildMongolianInstruction(maneuver: ValhallaManeuver, distanceMeters: number | null) {
  const instruction = maneuver.instruction?.toLowerCase() ?? "";
  const distance = distanceMeters && distanceMeters >= 10 ? `${distanceMeters} метрийн дараа ` : "";

  if (/\b(left|slight left)\b/.test(instruction)) return `${distance}зүүн тийш эргэ.`;
  if (/\b(right|slight right)\b/.test(instruction)) return `${distance}баруун тийш эргэ.`;
  if (/\bu[- ]?turn\b/.test(instruction)) return `${distance}буцаж эргэ.`;
  if (/\broundabout\b/.test(instruction)) return `${distance}тойргоор эргээд гэрийн зүг яв.`;
  if (/\barrive\b|\bdestination\b/.test(instruction)) return "Та гэртээ ойртож байна.";
  return `${distance}чигээрээ яв.`;
}

function decodePolyline6(encoded: string): [number, number][] {
  let index = 0;
  let lat = 0;
  let lon = 0;
  const points: [number, number][] = [];

  while (index < encoded.length) {
    const latResult = decodeChunk(encoded, index);
    index = latResult.index;
    const lonResult = decodeChunk(encoded, index);
    index = lonResult.index;

    lat += latResult.delta;
    lon += lonResult.delta;
    points.push([lat / 1e6, lon / 1e6]);
  }

  return points;
}

function decodeChunk(encoded: string, start: number) {
  let index = start;
  let result = 0;
  let shift = 0;
  let byte = 0;

  do {
    if (index >= encoded.length) throw new Error("Invalid polyline.");
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    index,
    delta: (result & 1) ? ~(result >> 1) : result >> 1,
  };
}
