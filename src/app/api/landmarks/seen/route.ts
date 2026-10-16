import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { SeenLandmarkReportSchema, saveSeenLandmarks } from "@/lib/seen-landmarks";

export const runtime = "nodejs";

/** The child's camera reports notable places it saw. The child is always the signed-in user. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "child") return Response.json({ error: "Only a child account shares seen places." }, { status: 403 });
  if (!(await allowAttempt(`seen-landmarks:${user.id}`, 20, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SeenLandmarkReportSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid landmarks." }, { status: 400 });

  return Response.json(await saveSeenLandmarks(user.id, parsed.data));
}
