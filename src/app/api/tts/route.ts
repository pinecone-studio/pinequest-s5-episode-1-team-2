import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return Response.json(
      { error: "ElevenLabs is not configured on the server." },
      { status: 500 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const text =
    typeof body === "object" && body !== null && "text" in body
      ? body.text
      : undefined;

  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Text is required." }, { status: 400 });
  }

  try {
    const elevenlabs = new ElevenLabsClient({ apiKey });
    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text: text.trim(),
      modelId: "eleven_v4",
      languageCode: "mn",
      outputFormat: "mp3_44100_128",
    });

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ElevenLabs TTS generation failed:", error);

    return Response.json(
      { error: "Unable to generate audio. Please try again." },
      { status: 502 },
    );
  }
}
