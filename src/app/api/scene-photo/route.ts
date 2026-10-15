import { getCurrentUser } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { readScenePhoto, saveScenePhoto, ScenePhotoReportSchema } from "@/lib/scene-photos";

export const runtime = "nodejs";

/** The child's camera sends one photo of its surroundings when it opens. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "child") return Response.json({ error: "Only a child account sends surroundings photos." }, { status: 403 });
  if (!(await allowAttempt(`scene-photo:${user.id}`, 6, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ScenePhotoReportSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid photo." }, { status: 400 });

  const result = await saveScenePhoto(user.id, parsed.data);
  if (result === "too-large") return Response.json({ error: "Photo too large." }, { status: 413 });
  return Response.json({ saved: result === "saved" });
}

/** A guardian fetches one photo of a child linked to them. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "guardian") return Response.json({ error: "Only guardian accounts can view photos." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const childId = params.get("childId");
  const photoId = params.get("id");
  if (!childId || !photoId) return Response.json({ error: "childId and id are required." }, { status: 400 });

  const image = await readScenePhoto(user.id, childId, photoId);
  if (!image) return Response.json({ error: "Photo not found." }, { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/jpeg",
      // A photo id never changes content, but it is private to this guardian.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
