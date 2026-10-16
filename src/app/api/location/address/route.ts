import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { listChildLocations } from "@/lib/location-sharing";
import { describePosition } from "@/lib/reverse-geocode";

export const runtime = "nodejs";

/**
 * Where a linked child is, in words. The position is read from the server's own record, never
 * from the request, so this cannot be used to look up arbitrary places or unlinked children.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "guardian") return Response.json({ error: "Only guardian accounts can read a child's address." }, { status: 403 });
  if (!(await allowAttempt(`address:${user.id}`, 20, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const childId = new URL(request.url).searchParams.get("childId");
  if (!childId) return Response.json({ error: "childId is required." }, { status: 400 });

  const child = (await listChildLocations(user.id)).find((linked) => linked.childId === childId);
  if (!child) return Response.json({ error: "Child not found." }, { status: 404 });
  if (!child.position) return Response.json({ address: null }, { headers: { "Cache-Control": "no-store, max-age=0" } });

  try {
    const address = await describePosition(child.position.latitude, child.position.longitude);
    return Response.json({ address }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("REVERSE_GEOCODE_FAILED:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Address lookup is unavailable." }, { status: 502 });
  }
}
