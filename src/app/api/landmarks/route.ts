import { NextRequest, NextResponse } from "next/server";

type Landmark = {
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distance: number;
};

const OVERPASS_URLS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Байршил шаардлагатай." },
      { status: 400 },
    );
  }

  const radius = 500;

  const query = `
    [out:json];
    (
      node["highway"="traffic_signals"](around:${radius},${lat},${lng});
      node["highway"="bus_stop"](around:${radius},${lat},${lng});
      nwr["amenity"="school"](around:${radius},${lat},${lng});
      nwr["amenity"="hospital"](around:${radius},${lat},${lng});
      nwr["amenity"="pharmacy"](around:${radius},${lat},${lng});
      nwr["shop"](around:${radius},${lat},${lng});
      nwr["amenity"="restaurant"](around:${radius},${lat},${lng});
      nwr["leisure"="park"](around:${radius},${lat},${lng});
    );
    out center;
  `;

  try {
    let elements: unknown[] | null = null;

    for (const url of OVERPASS_URLS) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            "User-Agent": "SafePath/1.0",
            Accept: "application/json",
          },
          body: new URLSearchParams({
            data: query,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(4_000),
        });

        const data: unknown = response.ok ? await response.json() : null;
        if (isOverpassResponse(data)) {
          elements = data.elements;
          break;
        }
      } catch {
        // Try the next OSM provider below.
      }
    }

    if (!elements) {
      const landmark = await getReverseLandmark(lat, lng);
      return NextResponse.json({ landmarks: landmark ? [landmark] : [] });
    }

    const landmarks: Landmark[] = elements
      .map((element: any) => {
        const latitude =
          element.lat ?? element.center?.lat;

        const longitude =
          element.lon ?? element.center?.lon;

        if (
          typeof latitude !== "number" ||
          typeof longitude !== "number"
        ) {
          return null;
        }

        const type =
          getLandmarkType(element.tags);

        return {
          name: getLandmarkName(type),
          type,
          latitude,
          longitude,
          distance: Math.round(
            calculateDistance(
              lat,
              lng,
              latitude,
              longitude,
            ),
          ),
        };
      })
      .filter((landmark): landmark is Landmark => landmark !== null)
      .sort(
        (a: Landmark, b: Landmark) =>
          a.distance - b.distance,
      )
      .slice(0, 10);

    return NextResponse.json({
      landmarks,
    });
  } catch (error) {
    console.error(
      "LANDMARK ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Ойролцоох зүйлсийг таних боломжгүй байна.",
      },
      { status: 500 },
    );
  }
}

function isOverpassResponse(value: unknown): value is { elements: unknown[] } {
  if (!value || typeof value !== "object" || !("elements" in value)) return false;
  return Array.isArray(value.elements);
}

async function getReverseLandmark(lat: number, lng: number): Promise<Landmark | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`,
      {
        headers: {
          "User-Agent": "SafePath/1.0",
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(4_000),
      },
    );
    const data: unknown = response.ok ? await response.json() : null;
    if (!data || typeof data !== "object") return null;

    const type = "type" in data && typeof data.type === "string" ? data.type : "landmark";
    const latitude = "lat" in data ? Number(data.lat) : NaN;
    const longitude = "lon" in data ? Number(data.lon) : NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return {
      name: getLandmarkName(type),
      type,
      latitude,
      longitude,
      distance: Math.round(calculateDistance(lat, lng, latitude, longitude)),
    };
  } catch {
    return null;
  }
}

function getLandmarkType(
  tags: any = {},
) {
  if (
    tags.highway ===
    "traffic_signals"
  ) {
    return "traffic_light";
  }

  if (
    tags.highway ===
    "bus_stop"
  ) {
    return "bus_stop";
  }

  if (tags.amenity === "school") {
    return "school";
  }

  if (tags.amenity === "hospital") {
    return "hospital";
  }

  if (tags.amenity === "pharmacy") {
    return "pharmacy";
  }

  if (tags.shop) {
    return "shop";
  }

  if (
    tags.amenity ===
    "restaurant"
  ) {
    return "restaurant";
  }

  if (
    tags.leisure === "park"
  ) {
    return "park";
  }

  return "landmark";
}

function getLandmarkName(type: string) {
  const names: Record<
    string,
    string
  > = {
    traffic_light:
      "гэрлэн дохио",
    bus_stop:
      "автобусны буудал",
    school: "сургууль",
    hospital: "эмнэлэг",
    pharmacy:
      "эмийн сан",
    shop: "дэлгүүр",
    restaurant:
      "ресторан",
    park: "парк",
    office: "ойрхон барилга",
    insurance: "ойрхон барилга",
    commercial: "ойрхон барилга",
    building: "ойрхон барилга",
    landmark:
      "ойролцоох газар",
  };

  return (
    names[type] ??
    "ойролцоох газар"
  );
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) /
    180;

  const dLng =
    ((lng2 - lng1) * Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      (lat1 * Math.PI) / 180,
    ) *
      Math.cos(
        (lat2 * Math.PI) / 180,
      ) *
      Math.sin(dLng / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    )
  );
}
