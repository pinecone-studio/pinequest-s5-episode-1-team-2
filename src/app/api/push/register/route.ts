import { createHash } from "node:crypto";
import * as z from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { getCollections, isDuplicateKey } from "@/lib/db/mongo";

export const runtime = "nodejs";

const RegistrationSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["android", "ios"]),
});
const TokenSchema = z.object({ token: z.string().min(20).max(4096) });

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Associates this installation's FCM token with the authenticated account and selected role. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Нэвтэрч орно уу." }, { status: 401 });
  if (user.role !== "child" && user.role !== "guardian") {
    return Response.json({ error: "Эхлээд хүүхэд эсвэл асран хамгаалагчийн үүргээ сонгоно уу." }, { status: 403 });
  }
  if (!(await allowAttempt(`push-register:${user.id}`, 10, 60_000))) {
    return Response.json({ error: "Хэт олон хүсэлт байна. Дахин оролдоно уу." }, { status: 429 });
  }

  const body = await readJson(request);
  if (body === null) return Response.json({ error: "JSON хүсэлт буруу байна." }, { status: 400 });
  const parsed = RegistrationSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Push token эсвэл platform буруу байна." }, { status: 400 });

  const { token, platform } = parsed.data;
  const { pushTokens } = await getCollections();
  const id = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  try {
    await pushTokens.updateOne(
      { token },
      {
        $set: { userId: user.id, role: user.role, platform, updatedAt: now },
        $setOnInsert: { _id: id, token },
      },
      { upsert: true },
    );
  } catch (error) {
    // Two registration events can race on app startup; retry the update if the unique token won elsewhere.
    if (!isDuplicateKey(error)) throw error;
    await pushTokens.updateOne({ token }, { $set: { userId: user.id, role: user.role, platform, updatedAt: now } });
  }

  const deliveryConfigured = Boolean(
    process.env.FCM_PROJECT_ID?.trim()
    && process.env.FCM_CLIENT_EMAIL?.trim()
    && process.env.FCM_PRIVATE_KEY?.trim(),
  );
  return Response.json({ success: true, deliveryConfigured }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

/** Removes a token only when it belongs to the signed-in user. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await allowAttempt(`push-delete:${user.id}`, 10, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = await readJson(request);
  if (body === null) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  const parsed = TokenSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid push token." }, { status: 400 });

  const { pushTokens } = await getCollections();
  await pushTokens.deleteOne({ token: parsed.data.token, userId: user.id });
  return Response.json({ success: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
