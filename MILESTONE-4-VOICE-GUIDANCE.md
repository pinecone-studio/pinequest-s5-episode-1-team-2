# SafePath Milestone 4 — Mongolian Voice Guidance

## Added

- Added an explicit **Дуугаар зааварлах** toggle in the camera navigation screen. Audio begins only after a user taps the toggle.
- Uses the existing authenticated `/api/tts` endpoint and its server-side ElevenLabs configuration; no API key is exposed to the client.
- Speaks the current GPS navigation instruction when enabled, then speaks again only when that instruction changes. Repeated renders with the same instruction do not cause repeated audio.
- Aborts a prior TTS request and stops the previous clip when a newer instruction arrives; revokes object URLs on completion and cleanup.
- Reuses the user's selected male/female companion voice and slow/normal speech speed.
- Stops voice output when the camera screen is closed.
- Displays localized feedback when the audio service is not configured or a request fails.

## Configuration

The server deployment must have `ELEVENLABS_API_KEY` and a voice ID configured using `ELEVENLABS_VOICE_ID`, or the specific `ELEVENLABS_FEMALE_VOICE_ID` / `ELEVENLABS_MALE_VOICE_ID` variables. The existing `/api/tts` endpoint must remain deployed with the app.

## Verification

The files are syntactically transpiled with the installed TypeScript compiler and the ZIP archive is integrity-tested. A full Next.js production build and a real Android-device audio test were not available in this build environment.

## Scope note

This milestone announces the current navigation instruction and subsequent instruction changes. The present route interface does not expose a reliable distance-to-next-maneuver field, so it does not invent a “turn in X meters” announcement. Accurate maneuver-approach prompts need route-step/leg metadata from the routing service.
