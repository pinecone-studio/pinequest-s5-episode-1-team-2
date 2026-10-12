# SafePath Milestone 4 — Safe-Zone-aware AI return navigation

## Included

- Added `GET /api/tracker/safe-zones`. It requires an authenticated child session and returns only that child's saved Safe Zones. The response is not cached and is rate-limited.
- The tracker now uses the zones configured by the linked guardian in the database. Demo Mode continues using the local demonstration zones.
- The closest active Safe Zone is selected using the project's existing boundary-distance calculation. The route destination, destination marker, safety state and AI destination name all use the selected zone instead of always targeting `SAFE_ZONES[0]`.
- Routes are not requested while the child is already inside a Safe Zone or while no actual zone is configured. If the selected destination changes, the route is recalculated immediately rather than waiting for the location throttle.
- When outside all configured Safe Zones and a route is available, the tracker sends the next route instruction to the existing assistant endpoint and uses the existing TTS endpoint to speak its reply.
- When the child is inside a Safe Zone, automatic navigation speech is stopped and a calm in-app reassurance message is shown. If route calculation fails, the assistant is asked for a short safety message without inventing route steps.
- Shows a clear message when no zones are configured or the server cannot load them.

## Setup

1. Keep the existing `.env.local` file locally; it is not included in this ZIP.
2. Ensure the guardian has linked the child and configured at least one Safe Zone at `/guardian/zones`.
3. Sign in to `/tracker` using the child account. The tracker must be opened under a child session to call `GET /api/tracker/safe-zones`.
4. For real navigation, allow GPS access and configure the existing route/AI/TTS environment variables. Gemini and ElevenLabs remain optional integrations; route fallback behavior remains the pre-existing OSRM fallback.
5. Demo Mode still uses the two illustrative local coordinates from `src/lib/safe-zones.ts`; do not treat these demo coordinates as the child's actual saved zones.

## Validation / limitations

- No database migration is needed; this milestone reads the existing `safeZones` collection created in prior milestones.
- The ZIP was edited, but `npm ci` timed out in the build environment, so a fresh production build and end-to-end GPS/route/TTS run could not be completed here. Run `bun run build` in the project's normal environment before deploying.
- The client still recalculates a route at most once per 10 seconds during ordinary movement; the existing tracker/reporting, GPS permissions, network and route provider affect real behavior.
- This is not OS-level push notification, a complete offline-navigation feature, or a guarantee of background operation when the tracker is closed.
