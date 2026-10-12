# pinequest-s5-episode-1-team-2

## Milestone 6 — Native Android push notifications

- Added opt-in Android push registration using `@capacitor/push-notifications` 7.0.3, compatible with Capacitor 7.
- Added authenticated, rate-limited FCM token registration/removal; tokens are scoped to the account and active device role.
- Added MongoDB `pushTokens` collection validation and indexes through the existing `bun run db:setup` command.
- Added server-only Firebase Cloud Messaging HTTP v1 delivery for persisted SOS and Safe Zone alerts; push payloads contain no precise GPS coordinates.
- Remote delivery requires Firebase client config in `android/app/google-services.json` and server-only `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` values.
- `bun install`, `npx cap sync android`, `bun run db:setup`, and `bun run build` are required before device testing. A real Android background notification test remains outstanding.

See `MILESTONE-6.md` for Firebase setup, tests, and limitations.
