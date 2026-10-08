import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { LocationReportSchema, saveChildLocation } from "@/lib/location-sharing";

export const runtime = "nodejs";

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

  const shared = await saveChildLocation(user.id, parsed.data);
  return Response.json({ shared });
}
