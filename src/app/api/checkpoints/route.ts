import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { childCheckpointView } from "@/lib/checkpoints";

export const runtime = "nodejs";

/** The signed-in child's goals and the rewards they have collected. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "child") return Response.json({ error: "Only a child account has checkpoints." }, { status: 403 });
  if (!(await allowAttempt(`checkpoints:${user.id}`, 30, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  return Response.json(await childCheckpointView(user.id), { headers: { "Cache-Control": "no-store, max-age=0" } });
}
