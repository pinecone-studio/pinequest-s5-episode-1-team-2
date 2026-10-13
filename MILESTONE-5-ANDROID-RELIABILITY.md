# SafePath — Milestone 5: Android reliability

This milestone improves behavior when connectivity changes or the app returns from the background. It does not promise continuous camera use while the app is backgrounded; Android and iOS restrict camera access when an app is not actively visible.

## Changes

- Added `src/hooks/use-network-status.ts` to listen to WebView/browser `online` and `offline` events.
- Tracker and guardian screens show a Mongolian offline warning. The warning distinguishes the last locally shown GPS position from fresh server-backed data.
- Camera scene recognition is disabled while offline. If connectivity drops during an AI request, the request is aborted and the UI explains how to retry.
- Server-based voice guidance stops on loss of connectivity and shows a visible error instead of appearing to continue.
- When the camera screen is backgrounded, the active camera stream is stopped, outstanding AI requests are aborted, and voice guidance is stopped. The person must tap **Камер асаах** again after returning, which is safer and more compatible with device camera policies.
- `useGeolocation` restarts its browser/WebView location watcher after returning from background or a page restored from the back-forward cache, so the UI can obtain a fresh fix.
- Android manifest explicitly declares `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION` permissions for current Android background-location behavior. The native plugin must still request runtime location/notification permissions and its foreground service needs to be correctly declared by the installed plugin.

## Manual test checklist

1. Open Tracker online; allow location permission and confirm the location updates.
2. Open Camera, grant camera permission, confirm preview works, then switch to another app. Return to SafePath: preview should be stopped with instructions to tap **Камер асаах** again.
3. While on Tracker, turn off Wi-Fi/mobile data. The offline banner should appear. AI scene recognition and server TTS should stop or refuse new requests with an explanatory message.
4. Restore connectivity. The offline banner should disappear and AI/TTS can be retried.
5. Return from background and check that GPS obtains a fresh update. On Android, separately confirm the background location notification/permissions if the project's native watcher is used.
6. Deny camera permission, then retry: the screen should show a permission-specific message rather than crashing.

## Validation status

- Source-level checks: inspect the changed TypeScript/TSX files for syntax and expected lifecycle handlers.
- A production Next.js build and a physical-device Android test must be run in the project environment with dependencies installed. This package should not be considered production-validated until those checks pass.

## Important runtime limitation

`capacitor.config.ts` currently configures the Capacitor app to load the hosted SafePath URL. Therefore changes to the Next.js UI will appear in the installed APK only after the same source is deployed to that hosted URL. Android manifest changes require rebuilding and reinstalling the APK. Camera use while the app is hidden/locked is intentionally not attempted.
