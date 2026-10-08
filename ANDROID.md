# SafePath Android

The Android wrapper is a Capacitor project in `android/` with package ID
`io.safepath.app`. It loads the deployed HTTPS application at
`https://safepath.app` so the existing Next.js API routes stay server-side and
provider keys are never embedded in the APK.

## Before building a release

1. Deploy this Next.js application to `https://safepath.app` and make its DNS
   record resolve over HTTPS.
2. Add valid production environment variables for Gemini and ElevenLabs on the
   hosting service. Do not add them to the Android project.
3. Install Android Studio and an Android SDK, then open the native project:

   ```bash
   bun run android:open
   ```

4. Use a physical Android device to grant location and notification permissions.
   Background location must be requested only after explaining why it is needed;
   Android may direct the user to system settings for the `Allow all the time`
   choice.
5. Build a signed release AAB from Android Studio before Play Store submission.

## Development commands

```bash
bun run android:sync
bun run android:open
bun run android:run
```

## Live location in the background

In the Android app, the child's location keeps being shared while the phone is
locked or another app is open. This uses `@capacitor-community/background-geolocation`
(`src/lib/location-source.ts`):

- It runs as a foreground service, so Android shows a permanent notification
  ("Таны байршлыг асран хамгаалагчтайгаа хуваалцаж байна") while sharing. It only
  needs "while using the app" location permission, not "Allow all the time".
- Reports go through native HTTP (`CapacitorHttp`), because Android throttles
  requests from a backgrounded WebView after about 5 minutes. Native HTTP still
  sends the login cookie.
- `android.useLegacyBridge` is on in `capacitor.config.ts`; without it, updates
  stop after about 5 minutes in the background.
- Sharing stops when the child pauses it, leaves the tracker screen, swipes the
  app away, or restarts the phone. In a browser it only works while the tracker
  page is open.

To test on a phone (Android Studio includes the Java 21 that Capacitor 7 needs):

1. `bun run android:sync`, then `bun run android:open` and run on a real phone.
2. Sign in as a child, open the tracker, allow location and notifications.
3. Lock the phone and walk around; the guardian's page should keep updating
   about every 10 seconds.
