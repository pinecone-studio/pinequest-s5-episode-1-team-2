import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { findNearbyLandmarks } from "@/lib/landmarks";

export const runtime = "nodejs";

/** Named places near a point, for the companion to guide by. Signed-in users only, so this is not an open map proxy. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await allowAttempt(`landmarks:${user.id}`, 20, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return Response.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const landmarks = await findNearbyLandmarks(latitude, longitude);
  return Response.json({ landmarks }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
