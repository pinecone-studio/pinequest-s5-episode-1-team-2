import { NextRequest, NextResponse } from "next/server";

type Landmark = {
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
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          data: query,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Landmark request failed");
    }

    const data = await response.json();

    const landmarks: Landmark[] = data.elements
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
          name: getLandmarkName(
            element.tags,
            type,
          ),
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
      .filter(Boolean)
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

function getLandmarkName(
  tags: any = {},
  type: string,
) {
  if (tags.name) {
    return tags.name;
  }

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