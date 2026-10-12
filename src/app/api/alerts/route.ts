import * as z from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { listGuardianSafetyAlerts, markGuardianSafetyAlertRead } from "@/lib/safety-alerts";

export const runtime = "nodejs";

/** In-app safety events for children linked to this guardian. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "guardian") {
    return Response.json({ error: "Only guardian accounts can read safety alerts." }, { status: 403 });
  }
  if (!(await allowAttempt(`alerts:${user.id}`, 60, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const alerts = await listGuardianSafetyAlerts(user.id);
  return Response.json({ alerts }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

/** Marks one event read, provided the guardian is still linked to the child. */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "guardian") {
    return Response.json({ error: "Only guardian accounts can update safety alerts." }, { status: 403 });
  }
  if (!(await allowAttempt(`alerts-read:${user.id}`, 60, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = z.object({ alertId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid alert id." }, { status: 400 });

  const result = await markGuardianSafetyAlertRead(user.id, parsed.data.alertId);
  if (result === "not-found") return Response.json({ error: "Alert not found." }, { status: 404 });
  if (result === "not-linked") return Response.json({ error: "You are not linked to this child." }, { status: 403 });
  return Response.json({ success: true });
}
