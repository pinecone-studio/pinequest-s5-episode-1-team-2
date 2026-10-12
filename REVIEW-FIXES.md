# SafePath milestone review fixes

Changes applied from the uploaded project archive:

- Repaired mojibake/incorrectly decoded Mongolian text in `src/app/guardian/page.tsx`.
- Changed guardian safety status and safe-zone distance to use the latest available linked child's location, rather than incorrectly using the guardian's own GPS location.
- Used the monitored child's configured safe zones on the map and in safety-state calculation when available.
- Mapped the risk engine's `WARNING` level to the caution UI tone.
- Rewrote `src/types/location.ts` with valid TypeScript formatting and types.

Validation note: the source archive was edited, but a fresh production build could not be rerun in this environment because package installation did not complete. Please run `bun run build` locally after extracting this archive. No `.env.local`, `.env`, `.git`, `node_modules`, or `.next` files are included.

## Milestone 3 additions

- Added per-child server-side geofence state and persisted safety alert events with unique transition keys to deduplicate overlapping reports.
- Added guardian-only `GET /api/alerts` and `PATCH /api/alerts` with relationship checks before returning or acknowledging alerts.
- Replaced the guardian dashboard's hard-coded example timeline with live, polled alert records and per-guardian read state.
- Added a GPS accuracy buffer to reduce boundary jitter and excluded cached reports older than two minutes from geofence transitions.
- Prevented delayed location reports from overwriting newer stored positions.
- Added 90-day alert retention and cleanup of location/geofence data when sharing stops or the last guardian link is removed.
- Fixed the MongoDB `replaceOne` replacement document in `src/lib/safety-alerts.ts`: removed `_id` from the replacement object, because MongoDB's TypeScript API uses `WithoutId<T>` for replacements and preserves/derives `_id` from the existing document or exact `_id` filter during upsert.

## Milestone 4 additions

- Added authenticated child-only `GET /api/tracker/safe-zones`; it returns a minimal, no-store list of the signed-in child's saved zones and applies rate limiting.
- Replaced the tracker page's real-mode hard-coded `SAFE_ZONES[0]` destination with the closest configured zone belonging to the signed-in child.
- The route destination, map marker, risk evaluation, and assistant destination now align on the selected saved zone. Demo Mode still uses the local sample zones.
- The companion only asks for walking directions when outside all configured zones and a route is ready. It stops the active speech and gives a calm in-zone message after the child returns to a zone; route errors fall back to a short safety message rather than a fabricated maneuver.
- Added explicit UI states for loading zones, missing guardian-configured zones, and zone API failures.
- Validation note: dependency installation timed out in this environment, so production build/type-check remains to be run locally using `bun run build`.

## Milestone 5 additions

- Added authenticated child-only `POST /api/sos`, with per-child rate limiting and a server-generated SOS alert for linked guardians.
- Added a two-step tracker SOS control; real sends are disabled in Demo Mode.
- Reused the existing guardian in-app alert feed, added an SOS event type to TypeScript and the MongoDB validator, and highlighted SOS events in the guardian UI.
- Kept precise coordinates out of alert records; guardians must use the existing linked-child location feed for the last shared position.
- Reminder: run `bun run db:setup` to update the existing MongoDB `safetyAlerts` validator before SOS testing.
- Limitations: no SMS/push delivery and no emergency-services integration. The guardian dashboard must be open for its current polling UI to show newly created alerts.
- Validation: production build and physical-device flow must be run locally before deployment.

## Milestone 6 additions

- Added native Android FCM opt-in/registration UI and authenticated token register/remove routes.
- Added role-scoped push token persistence with a unique token index; token ownership comes from the verified cookie session.
- Added a server-only Firebase Cloud Messaging HTTP v1 sender using `jose` and service-account environment variables. The private key is never passed to the browser or stored in the repository.
- Added push delivery after a safety event is persisted. One device's FCM failure does not remove the in-app alert or block attempts to other devices.
- SOS and Safe Zone push payloads contain alert metadata but no exact coordinates; guardian device tokens are filtered by current guardian-child link and guardian role.
- Added current-device token cleanup at logout.
- Required external setup remains: Firebase Android app config (`android/app/google-services.json`), server `FCM_*` environment variables, dependency install/sync, database setup, and real-device tests.
- Validation limitation: this editing environment could not install dependencies from npm, so no fresh TypeScript/production build or real Firebase delivery test was completed.
