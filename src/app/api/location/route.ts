import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { LocationReportSchema, listChildLocations, saveChildLocation } from "@/lib/location-sharing";

export const runtime = "nodejs";

/**
 * A guardian may read only the children explicitly linked to their signed-in account.
 * A child cannot use this endpoint to enumerate other users.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "guardian") return Response.json({ error: "Only guardian accounts can read linked child locations." }, { status: 403 });

  const children = await listChildLocations(user.id);
  return Response.json({ children }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

/** The child's phone reports where it is. The child is always the signed-in user, never an id from the body. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "child") return Response.json({ error: "Only a child account shares its location." }, { status: 403 });
  if (!(await allowAttempt(`location:${user.id}`, 30, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = LocationReportSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid location." }, { status: 400 });

  // Flat, so the phone can read `shared`, `paused` and `watchers` straight off the body.
  return Response.json(await saveChildLocation(user.id, parsed.data));
}
