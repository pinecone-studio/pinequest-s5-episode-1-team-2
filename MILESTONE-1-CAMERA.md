# SafePath — Milestone 1: Camera Preview

## Included
- Rear-facing camera preview using `getUserMedia` with a compatibility fallback.
- Prevents multiple simultaneous camera permission requests.
- Loading state while the camera permission request is pending.
- Clear Mongolian error messages for blocked permission, missing camera, insecure context, and camera-in-use conditions.
- Camera tracks are stopped when the camera is turned off or the component is unmounted.
- Compass permission is handled separately; camera preview continues to work if compass access is denied or unsupported.
- Android manifest declares optional camera hardware and the camera permission.
- Existing Tracker “Камераар чиглүүлэх” entry point and route/map overlay are retained.

## Test on a device
1. Use the project with the existing `.env.local` created locally; do not commit secret values.
2. Run `npm install` or `bun install`, then `npm run build` (or `bun run build`).
3. For Android, run `npx cap sync android`, open Android Studio, install/run on a physical phone, and open Tracker.
4. Tap **Камераар чиглүүлэх** → **Камер асаах** and accept the Android camera permission.
5. Confirm the rear-camera preview appears; switch back to **Газрын зураг** and verify the camera turns off.
6. Deny camera permission and confirm the Mongolian error is shown instead of a blank preview.

## Scope note
This milestone establishes the camera permission and preview foundation. It does not yet use AI to identify objects or street signs; that is planned for Milestone 2. The route arrow still depends on GPS route data and the device compass when available.

## Safe Zone exit auto-open behavior (added)
- When the current location transitions from inside a configured Safe Zone to outside all configured zones, a five-minute countdown starts.
- Returning to a Safe Zone during the countdown cancels the countdown.
- If the deadline expires while the tracker is still outside, the Tracker switches to camera view and attempts to start the rear camera automatically.
- The countdown deadline is stored locally so a refresh can resume an already-started countdown; a first-ever location fix outside a zone does not start a false countdown.
- Automatic camera startup depends on browser/WebView camera permission and platform policy. Grant camera permission in advance and keep the app foregrounded for the most reliable behavior. The app cannot force the camera to turn on while closed or while the phone is locked.
