# SafePath Milestone 2 — linked child live location

## Included
- `GET /api/location`: guardian-only endpoint returns locations for children linked to the authenticated guardian. It never accepts a child ID from the caller.
- Guardian dashboard shows linked children, sharing status, last report age, distance from guardian's current GPS position, and an estimated speed from successive location reports observed by the page.
- Speed is shown as unavailable until two timestamped reports are available; implausible GPS jumps above 160 km/h are ignored.
- Existing route API and Leaflet map are preserved.

## Important setup
- Configure `MONGODB_URI` in local `.env.local` (do not commit that file).
- Run `bun run db:setup`, then `bun run dev`.
- Sign in using a guardian account and ensure a child is linked and sharing is enabled.
- GPS must be permitted by the browser/device. Web geolocation generally requires HTTPS or localhost.

## Scope note
This milestone displays straight-line distance to the child, not driving/walking distance. Speed is estimated from reports observed while the guardian page is open; it is not historical trip analytics and is not a prediction of future destinations. Those require persistent location-history records and a separate consent/retention design.
