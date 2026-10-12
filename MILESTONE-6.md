# SafePath Milestone 6 — Native Android push notifications

## Goal

Deliver the existing safety events to linked guardians' Android devices even when the guardian dashboard is not open. Milestone 6 adds Firebase Cloud Messaging (FCM) token registration and server-side delivery for SOS and Safe Zone events. The in-app event feed remains the source of truth.

## Changes

- Added `@capacitor/push-notifications` version `7.0.3`, compatible with the project's Capacitor 7 stack.
- Added a native Android opt-in banner on both `/tracker` and `/guardian`. The app asks for permission only after the user presses **Идэвхжүүлэх**; if permission was already granted, it refreshes/registers the current FCM token on app startup.
- Added `POST /api/push/register` and `DELETE /api/push/register`. Only signed-in child/guardian sessions can register tokens. A token is associated with the authenticated user and currently selected role, never a user ID supplied by the client. Token registration is rate-limited.
- Added the `pushTokens` collection, MongoDB validator, unique token index, and role/platform fields.
- Added a server-only FCM HTTP v1 sender using the existing `jose` dependency. The Firebase service-account private key is read only from server environment variables. The app never receives this key.
- Sends FCM notifications for persisted `SOS`, `ZONE_EXIT`, `OUTSIDE_SAFE_ZONES`, and `ZONE_ENTER` events, only to token records with the guardian role whose user IDs are currently linked to that child.
- Uses high Android priority for SOS/exit/outside alerts, a shorter delivery TTL, and no exact GPS coordinates in push payloads. Invalid/unregistered tokens are pruned when FCM explicitly reports `UNREGISTERED`.
- Failed push delivery does not delete or invalidate the saved in-app alert.
- Logout submits the current device token and removes only that token for that account, rather than disabling push on all of the user's devices.

## Required Firebase setup

Push delivery will not work until a Firebase project and credentials are configured; those credentials were not present in the source ZIP.

1. In Firebase Console, create or select a project and add an **Android app** with package ID `io.safepath.app`.
2. Download its `google-services.json` and place it at `android/app/google-services.json`. This file is intentionally not included in the ZIP. The app-level Gradle file is already prepared to apply Google Services when that file exists.
3. In Firebase Project Settings → Service accounts, generate a service account key. Enable the Firebase Cloud Messaging API for the project and ensure the service account has permission to send FCM messages (`cloudmessaging.messages.create`, for example through the Firebase Cloud Messaging API Admin role).
4. Set these **server-only** values in local `.env.local` and in Vercel Project Settings → Environment Variables:

   ```dotenv
   FCM_PROJECT_ID=your-firebase-project-id
   FCM_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-firebase-project-id.iam.gserviceaccount.com
   FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_LINES\n-----END PRIVATE KEY-----\n"
   ```

   Use the exact `project_id`, `client_email`, and `private_key` values from the downloaded service-account JSON. Never add that JSON or the private key to Git, client code, screenshots, or this ZIP. Do not prefix them with `NEXT_PUBLIC_`.

5. Install the dependency and sync the native Android project:

   ```powershell
   bun install
   npx cap sync android
   bun run db:setup
   bun run build
   ```

6. Open Android Studio with `npx cap open android`, build/install the app on a real Android device, sign in on a guardian account, and press **Идэвхжүүлэх**. Link a child account on another device, enable child location sharing, then test a confirmed Safe Zone exit and SOS. Also test with the guardian app minimized and closed.
7. Add the three `FCM_*` variables to the relevant Vercel environments and redeploy. Native push is configured per Android app install; Vercel environment variables alone do not install the Firebase client configuration on the device.

## Limitations and validation

- This milestone targets **Android**. iOS needs APNs credentials, Xcode Push Notifications capability, and AppDelegate integration before it can be enabled there.
- Web/PWA browser push is not implemented. On non-native browsers the opt-in banner is not shown; the existing in-app alert feed still works.
- The app's saved alert feed continues to work even if Firebase has not been configured. In that case the server intentionally skips remote delivery.
- A full `bun run build`, Firebase credential test, Android Studio build, and real-device background-delivery test have not been completed in this editing environment. Run the commands above before deploying, and only treat push as production-ready after device-level tests pass.
- Push delivery is best effort and is not an emergency-services dispatch or a guarantee of delivery. In immediate danger, contact local emergency services directly.
