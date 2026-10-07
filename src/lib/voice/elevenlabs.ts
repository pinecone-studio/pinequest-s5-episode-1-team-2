import "server-only";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const MAX_SPEECH_TEXT_LENGTH = 280;

export async function generateMongolianSpeech(text: string, requestedVoiceId?: string) {
  if (text.length > MAX_SPEECH_TEXT_LENGTH) {
    throw new Error("Speech text is too long.");
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = requestedVoiceId?.trim() || process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey || !voiceId) {
    throw new Error("ElevenLabs is not configured.");
  }

  const elevenlabs = new ElevenLabsClient({ apiKey });
  const stream = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    modelId: process.env.ELEVENLABS_MODEL?.trim() || "eleven_v4",
    outputFormat: "mp3_44100_128",
    languageCode: "mn",
  });

  return new Response(stream).arrayBuffer();
}
