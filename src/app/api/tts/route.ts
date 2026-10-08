import { getSessionUserId } from "@/lib/auth/dal";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { generateMongolianSpeech } from "@/lib/voice/elevenlabs";

export const runtime = "nodejs";

const maxTextLength = 280;

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await allowAttempt(`api:${userId}`, 60, 60_000))) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body) || Object.keys(body).some((key) => key !== "text" && key !== "voice")) {
    return Response.json({ error: "Invalid speech request." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voice = body.voice;
  if (
    !text ||
    text.length > maxTextLength ||
    (voice !== undefined && voice !== "female" && voice !== "male")
  ) {
    return Response.json({ error: "Invalid speech request." }, { status: 400 });
  }

  const voiceId = voice === "male"
    ? process.env.ELEVENLABS_MALE_VOICE_ID || process.env.ELEVENLABS_VOICE_ID
    : process.env.ELEVENLABS_FEMALE_VOICE_ID || process.env.ELEVENLABS_VOICE_ID;
  if (!process.env.ELEVENLABS_API_KEY || !voiceId) {
    return Response.json({ error: "Speech is not configured." }, { status: 503 });
  }

  try {
    const audio = await generateMongolianSpeech(text, voiceId);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Speech generation failed." }, { status: 502 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
