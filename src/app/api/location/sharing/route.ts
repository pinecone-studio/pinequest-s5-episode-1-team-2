import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { getSharingState, setSharingPaused, SharingUpdateSchema } from "@/lib/location-sharing";

export const runtime = "nodejs";

/** The signed-in child, or the error response to send instead. */
async function currentChild() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "child") return Response.json({ error: "Only a child account shares its location." }, { status: 403 });
  return user;
}

/** The child's own sharing state. No location is sent to read it. */
export async function GET() {
  const child = await currentChild();
  if (child instanceof Response) return child;
  return Response.json(await getSharingState(child.id), { headers: { "Cache-Control": "no-store" } });
}

/** The child pauses or resumes sharing. Pausing deletes the stored position at once. */
export async function PUT(request: Request) {
  const child = await currentChild();
  if (child instanceof Response) return child;
  if (!(await allowAttempt(`sharing:${child.id}`, 20, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SharingUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid sharing update." }, { status: 400 });
  return Response.json(await setSharingPaused(child.id, parsed.data.paused));
}
