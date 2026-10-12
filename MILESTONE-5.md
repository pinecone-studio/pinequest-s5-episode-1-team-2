# SafePath Milestone 5 — Child-triggered SOS alert

## Goal

Let the child explicitly notify currently linked guardians when they need help. This is an in-app alert that appears in the guardian's existing safety-alert feed. It is not SMS, an OS push notification, or an emergency-services call.

## Included

- Added `POST /api/sos`, restricted to a signed-in child session. The server always uses the authenticated child's ID; it does not accept a child ID from the request body.
- Added a two-step SOS control to `/tracker`. Demo Mode disables real SOS delivery to avoid sending test alerts by mistake.
- Stores an urgent `SOS` event in the existing `safetyAlerts` collection. No GPS coordinates are copied into the alert; guardians continue to use the authenticated linked-child location feed.
- The alert is shown prominently in the guardian dashboard and can be marked read using the existing guardian-only alerts API.
- Rate-limits a child to one SOS attempt per 30 seconds to reduce duplicate taps and abuse.
- Returns clear errors when the session is missing, the session is not a child, no guardian is linked, the rate limit is exceeded, or storage fails.
- Updated the MongoDB schema validator to accept `SOS` event types.

## Setup

1. Preserve your existing `.env.local`; do not share it or add it to Git.
2. Run `bun run db:setup` to update the existing `safetyAlerts` validator so it accepts the new `SOS` type. This command is safe to run repeatedly.
3. Run `bun run build`, then start the app with `bun run dev`.
4. Link a guardian and child account. Sign in on the child device and open `/tracker` with Demo Mode OFF.
5. Tap **Яаралтай тусламж — SOS**, then confirm **Тийм, илгээх**. Open `/guardian` in the linked guardian account; the SOS should appear in the in-app alert feed.
6. Test no linked guardian, wrong role, a failed network request, and repeated taps.

## Important limitations

- Guardian alerts are polled while the guardian dashboard is open. If the dashboard is closed, this milestone does not guarantee an immediate notification. SMS/OS push delivery must be integrated and tested separately.
- The SOS does not call emergency services and does not itself transmit coordinates. Guardians can see the latest location only if location sharing is enabled and a recent position exists.
- This is a safety-support feature, not a replacement for contacting local emergency services when there is immediate danger.
- A fresh production build and physical-device end-to-end run have not been completed in this editing environment. Run `bun run build` locally before deploying.
