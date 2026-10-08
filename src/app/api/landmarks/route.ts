import { NextRequest, NextResponse } from "next/server";

type Landmark = {
  id: number;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distance: number;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      {
        error: "lat болон lng шаардлагатай.",
      },
      { status: 400 },
    );
  }

  const radius = 500;

  const query = `
    [out:json];
    (
      node["highway"="traffic_signals"](around:${radius},${lat},${lng});
      node["highway"="bus_stop"](around:${radius},${lat},${lng});
      node["amenity"="school"](around:${radius},${lat},${lng});
      node["amenity"="hospital"](around:${radius},${lat},${lng});
      node["amenity"="pharmacy"](around:${radius},${lat},${lng});
      node["shop"](around:${radius},${lat},${lng});
      node["amenity"="restaurant"](around:${radius},${lat},${lng});
      node["leisure"="park"](around:${radius},${lat},${lng});
    );

    out center;
  `;

  try {
    const response = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          data: query,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();

    const landmarks: Landmark[] = data.elements.map((element: any) => {
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;

      const type = getLandmarkType(element.tags);

      return {
        id: element.id,
        name: getLandmarkName(element.tags, type),
        type,
        latitude,
        longitude,
        distance: Math.round(
          calculateDistance(lat, lng, latitude, longitude),
        ),
      };
    });

    landmarks.sort((a, b) => a.distance - b.distance);

    return NextResponse.json({
      latitude: lat,
      longitude: lng,
      radius,
      landmarks: landmarks.slice(0, 20),
    });
  } catch (error) {
    console.error("LANDMARK API ERROR:", error);

    return NextResponse.json(
      {
        error: "Ойролцоох landmark авахад алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}

function getLandmarkType(tags: any = {}) {
  if (tags.highway === "traffic_signals") {
    return "traffic_light";
  }

  if (tags.highway === "bus_stop") {
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

  if (tags.amenity === "restaurant") {
    return "restaurant";
  }

  if (tags.leisure === "park") {
    return "park";
  }

  return "landmark";
}

function getLandmarkName(tags: any = {}, type: string) {
  if (tags.name) {
    return tags.name;
  }

  const defaultNames: Record<string, string> = {
    traffic_light: "Гэрлэн дохио",
    bus_stop: "Автобусны буудал",
    school: "Сургууль",
    hospital: "Эмнэлэг",
    pharmacy: "Эмийн сан",
    shop: "Дэлгүүр",
    restaurant: "Ресторан",
    park: "Парк",
    landmark: "Ойролцоох газар",
  };

  return defaultNames[type] ?? "Ойролцоох газар";
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const earthRadius = 6371000;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}