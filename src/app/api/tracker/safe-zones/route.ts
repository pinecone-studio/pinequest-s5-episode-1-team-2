import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { getCollections } from "@/lib/db/mongo";

export const runtime = "nodejs";

/** Returns only the saved Safe Zones for the currently authenticated child account. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "child") {
    return Response.json({ error: "Only child accounts can read their own navigation zones." }, { status: 403 });
  }
  if (!(await allowAttempt(`tracker-zones:${user.id}`, 30, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const { safeZones } = await getCollections();
  const records = await safeZones
    .find({ childId: user.id })
    .sort({ createdAt: 1 })
    .limit(10)
    .toArray();

  const zones = records.map((zone) => ({
    id: zone._id,
    name: zone.name,
    latitude: zone.latitude,
    longitude: zone.longitude,
    radiusMeters: zone.radiusMeters,
  }));

  return Response.json(
    { zones },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
