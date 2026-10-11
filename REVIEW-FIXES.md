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
