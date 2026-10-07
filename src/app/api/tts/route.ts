import { generateMongolianSpeech } from "@/lib/voice/elevenlabs";

export const runtime = "nodejs";

const maxTextLength = 280;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body) || Object.keys(body).some((key) => key !== "text" && key !== "voiceId")) {
    return Response.json({ error: "Invalid speech request." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voiceId = body.voiceId;
  if (
    !text ||
    text.length > maxTextLength ||
    (voiceId !== undefined && (typeof voiceId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(voiceId)))
  ) {
    return Response.json({ error: "Invalid speech request." }, { status: 400 });
  }

  if (!process.env.ELEVENLABS_API_KEY || (!voiceId && !process.env.ELEVENLABS_VOICE_ID)) {
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
