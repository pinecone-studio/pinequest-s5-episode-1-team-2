# SafePath Milestone 3 — Safe Zone exit alerts

## Included

- Fresh child location reports are checked against that child's saved Safe Zones on the server.
- Leaving all Safe Zones creates a `ZONE_EXIT` in-app alert. The first fresh report outside every configured zone creates an `OUTSIDE_SAFE_ZONES` alert; entering a Safe Zone from outside creates `ZONE_ENTER`.
- The geofence state is stored per child, so repeated location polls do not create a new alert on every report. A unique transition key also deduplicates overlapping reports.
- A GPS accuracy buffer (at least 25 m, capped at 100 m) reduces noisy boundary flips. Cached reports older than two minutes do not produce geofence transitions.
- Delayed reports cannot overwrite a more recent stored location.
- Guardians can list the latest 50 alerts for linked children and mark them read. Alert API operations verify the guardian session and the guardian-child link.
- Alert history retains event type, safe-zone name, message, timestamp, and per-guardian read state; it does not copy exact GPS coordinates into alert records. Events expire after 90 days through a MongoDB TTL index.
- Pausing sharing clears the last location and geofence baseline. Removing the last guardian clears locations, safe zones, geofence state, and alert history.

## Setup

1. Keep your existing `.env.local`; never put it in the ZIP or Git.
2. Make sure `MONGODB_URI` and `SESSION_SECRET` are configured.
3. Run `bun run db:setup` to create/update the new `geofenceStates` and `safetyAlerts` collections and indexes.
4. Run `bun run dev` and sign in as a guardian. Link a child and configure at least one saved Safe Zone at `/guardian/zones`.
5. Sign in as the child on another device, enable location sharing, and test with a physical device or controlled/demo location.
6. The guardian dashboard's “Аюулгүй байдлын мэдэгдэл” section polls while that page is open. The current milestone is an in-app alert feed, not SMS or OS push delivery.

## Validation notes

- A geofence transition is evaluated only when a new, fresh location report is accepted by the server. Background delivery still depends on the configured Android background-location setup and permissions.
- Geofence comparisons use server-stored per-child Safe Zones. If no Safe Zone is configured, no geofence alert is generated.
- Use two separate accounts/devices for a realistic end-to-end test. Production build success alone does not prove GPS, MongoDB, or Android background behaviour.
