# SafePath — 5-minute Safe Zone exit camera activation

## Behavior
- The Tracker watches the calculated Safe Zone state. The timer is armed only after a known inside-to-outside transition.
- A visible countdown starts at 05:00. The deadline is saved locally to resume after a refresh.
- Returning inside a configured Safe Zone clears the timer and removes its saved deadline.
- If the deadline expires while outside, Tracker switches to the camera guidance view and attempts to start the rear-facing camera.
- If the camera was opened by this timer and the user returns to a Safe Zone, the camera view closes again.

## Device and privacy limitations
- Grant Camera permission before testing for the most reliable auto-start. Some browsers/WebViews still require user interaction or show a permission prompt when `getUserMedia` is first called.
- Android/iOS will not let a web page force the camera to open while the app is closed or the phone is locked. Keep SafePath in the foreground for the most reliable behavior. Location updates and JavaScript timers can be throttled by the operating system in the background.
- The camera only shows a live preview and route overlay in this milestone; it does not yet use AI to identify signs or landmarks.

## Test steps
1. Install/run the app on a real Android phone and grant location and camera permissions.
2. Start in a configured Safe Zone and verify the app considers the location inside.
3. Leave the zone. Confirm the `05:00` countdown appears and decreases.
4. Return to any configured Safe Zone before the timer reaches zero. Confirm the countdown disappears and the camera does not auto-open.
5. Leave the zone again and remain outside until the deadline. Confirm the camera guidance view opens and attempts to start the rear camera.
6. Repeat with camera permission denied to verify the app displays the camera error and the manual camera button remains available.

## Build check
The modified TSX files pass TypeScript transpilation/syntax checks. A complete Next.js production build was not run in this environment because the project dependencies are not installed and package registry access was unavailable. Run `bun install` and `bun run build` locally to finish validation.
