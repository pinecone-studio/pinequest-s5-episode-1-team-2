# SafePath — Milestone 2: AI Camera Scene Recognition

## Included

- Added authenticated `POST /api/vision/describe` endpoint that sends a downsized camera still frame to Gemini using server-side `GEMINI_API_KEY`.
- Added input validation for JPEG/PNG/WebP data URLs, request size limits, and per-user request rate limits.
- Added camera UI action **“Орчныг AI-аар таних”**. The user starts the camera, then requests a single-frame description.
- Only a single still frame is uploaded after the user taps the action. The response is shown in Mongolian and explicitly warns that an image alone cannot establish road-crossing safety or replace GPS/routing.
- Added optional `GEMINI_VISION_MODEL` server environment setting (default `gemini-3.8-flash`). No secrets are shipped in this ZIP.

## Required configuration

Set `GEMINI_API_KEY` on the Next.js server/deployment. Optionally set `GEMINI_VISION_MODEL`. Do not use a `NEXT_PUBLIC_` prefix for the API key. The vision endpoint requires a valid SafePath login/session and MongoDB-backed rate limiting.

## Test steps

1. Install dependencies with `bun install`.
2. Configure `.env.local` with a valid `GEMINI_API_KEY` and working MongoDB/session settings.
3. Run `bun run build` or `bun run dev`.
4. Log into SafePath and open Tracker → **Камераар чиглүүлэх**.
5. Allow camera access, then tap **Орчныг AI-аар таних**.
6. Confirm a Mongolian description appears; then try a dark/obscured frame, missing API key, and unsigned session.

## Scope and limitations

This milestone analyzes one still frame when the user taps the action. It does not continuously stream camera video to AI, infer a verified street address, or autonomously decide when it is safe to cross a road. Route and GPS remain the main navigation sources.

## Validation status

Source-level structure was reviewed. Production build and device testing must be run in the project environment after installing dependencies and configuring secrets; do not treat this ZIP as a device-tested release.
