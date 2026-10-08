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

## Safety-monitoring boundary

The manifest declares precise, approximate, background-location, and
notification permissions, but declaring a permission never grants it. The
background safe-zone monitor must request consent in context and use a native
Android geofencing implementation before it can notify while the app is closed.
The existing web `watchPosition` monitor continues to work only while the
tracker is open.
