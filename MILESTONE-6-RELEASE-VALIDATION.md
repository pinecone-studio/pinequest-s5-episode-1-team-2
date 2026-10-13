# SafePath — Milestone 6: QA and release readiness

This milestone adds repeatable preflight checks and clarifies the final Android test/release process. It does **not** certify a production release by itself: a dependency-backed Next.js build, live MongoDB/API tests, and tests on the actual Android phone are still required.

## Code/configuration changes

- Added `bun run typecheck` and `bun run qa` to make TypeScript and lint checks repeatable.
- Added `bun run release:preflight` to validate critical project files, Android permissions, app ID alignment, lockfiles, environment-variable documentation, and the Gradle wrapper's line endings/permissions.
- Added `bun run android:debug:apk` and `bun run android:release:aab` convenience scripts.
- Changed `db:setup` to invoke the `tsx` runner instead of running the MongoDB driver through Bun. This avoids the `node:v8 isBuildingSnapshot` runtime error observed with Bun 1.3.14. The setup script is idempotent, but it must be run with a valid `MONGODB_URI`.
- Updated the MongoDB validator for `users.childPhone` to accept `null`, matching the declared `UserRecord` type (`childPhone?: string | null`).

## Run checks on the development Mac

From the project root:

```bash
bun install
bun run release:preflight
bun run typecheck
bun run lint
bun run build
```

Run the database setup only if the `.env.local` has a valid, authorized `MONGODB_URI`:

```bash
bun run db:setup
```

Do not paste `.env.local`, connection strings, API keys, session secrets, service-account JSON, or signing keystores into chat or add them to the ZIP/Git.

## Android debug APK

```bash
cd android
perl -pi -e 's/\r$//' gradlew
chmod +x gradlew
./gradlew assembleDebug
```

APK location:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install/update using Android Debug Bridge (ADB):

```bash
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Capture a crash instead of guessing

With the phone connected and USB debugging authorized:

```bash
adb logcat -c
adb shell am force-stop io.safepath.app
adb shell monkey -p io.safepath.app 1
sleep 8
adb logcat -d -v time | grep -iE 'FATAL EXCEPTION|AndroidRuntime|io.safepath.app|Capacitor|chromium|SIGABRT|crash' | tail -n 120
```

Share only the relevant error lines. Remove access tokens, emails, personal location data, and other private values before sharing logs.

## Required manual QA matrix

- [ ] Fresh install: app opens; login/register screens render; no startup crash.
- [ ] Existing install upgrade: app opens without losing the stored session unexpectedly.
- [ ] Registration/login/logout; invalid credentials show a user-friendly message.
- [ ] Legacy account with `role: null` can select guardian/child role and save it to MongoDB. Check the server log if MongoDB returns `Document failed validation`; this remains a release blocker until verified with the real database.
- [ ] Guardian/child pairing: valid code links accounts once; expired/reused code is rejected.
- [ ] Safe Zone: confirm GPS fix, exit detection, guardian alert, the five-minute countdown, cancellation on re-entering the zone, and the intended camera behavior.
- [ ] Camera: grant and deny permission; open/close camera; navigate away and back; confirm camera is stopped while app is backgrounded and can be restarted in foreground.
- [ ] AI scene recognition: configure `GEMINI_API_KEY` on the server; successful image analysis, missing key, offline mode, oversized/invalid images, and rate limiting all show understandable states.
- [ ] Voice guidance: configure ElevenLabs credentials; explicit enable action, correct language, stop/restart, duplicate-instruction behavior, network loss, and missing key.
- [ ] GPS route and camera descriptions remain separate; the AI does not replace the route engine or claim a route crossing is safe.
- [ ] Internet loss/recovery: offline status is visible and live/server-backed data is not presented as fresh while disconnected.
- [ ] Android permission denial, notification permission, background location, device rotation, lock/unlock, and battery-saving behavior.
- [ ] Verify current deployed web code and server environment before testing the APK. `capacitor.config.ts` points at a hosted SafePath URL, so web UI changes only appear in the APK after that host is deployed; native Android manifest/code changes require a new APK.

## Production release steps

1. Complete all checks above, then run `bun run build` and fix every error.
2. Deploy the same source to the hosted URL configured in `capacitor.config.ts`; verify the deployed URL on mobile browser.
3. Build/install a new debug APK and repeat device QA.
4. For Google Play, increment Android `versionCode` and update `versionName`, configure a protected upload/signing key outside the repository, then run `bun run android:release:aab` and validate the generated bundle. The debug APK is for testing and is not a Play Store release artifact.
5. Verify privacy disclosure/consent for camera frames, GPS, AI processing, retention, and guardian access before releasing to families.

## Validation results for this package

- Project/package metadata, source edits, XML syntax, Gradle wrapper line endings/permissions, and ZIP integrity are checked by the packaging/preflight process.
- A full dependency install did not finish in the packaging environment, so TypeScript, ESLint, production build, Gradle compilation, live MongoDB, AI API, and physical-device tests are **not claimed as passing**.
