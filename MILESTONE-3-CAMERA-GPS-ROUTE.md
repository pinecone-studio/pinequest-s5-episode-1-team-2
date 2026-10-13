# SafePath — Milestone 3: Camera + GPS Route Integration

## Included

- The camera scene-analysis request now receives sanitized route context: current route instruction, destination label, remaining distance, bearing to a route look-ahead point, device compass heading, relative turn angle, and whether route geometry is available.
- The server validates and bounds each context field before adding it to the Gemini prompt. The prompt treats route values as navigation metadata only and does not allow a visual description to replace the route engine's instruction.
- The scene-analysis endpoint returns a separate, validated `routeContext` object with the result. The camera UI shows the GPS instruction, destination, remaining distance, and a coarse relative direction beside the AI description.
- GPS route guidance remains separate from visual observations. The AI cannot declare a crossing safe, claim an unseen landmark exists, or silently alter the next turn.
- The user still explicitly taps to analyze a single downsized camera frame. No continuous camera stream is sent to AI.

## Required configuration

- Keep `GEMINI_API_KEY` on the server/deployment only; never prefix it with `NEXT_PUBLIC_`.
- The existing GPS/route engine, session authentication, and MongoDB-backed rate limiting remain required.

## Test steps

1. Run `bun install` and configure the existing `.env.local` values including MongoDB/session and `GEMINI_API_KEY`.
2. Run `bun run dev` and sign in.
3. Open Tracker, wait for GPS location and the walking route to appear, then open **Камераар чиглүүлэх**.
4. Allow camera access and tap **Орчныг AI-аар таних**.
5. Verify the response has both a visual description and a separate GPS route guidance panel. Compare its instruction and destination with the always-visible route banner.
6. Test with unavailable compass, no route geometry, a dark frame, missing API key, and a signed-out session. The route instruction should not be replaced by AI text.

## Validation status

Source-level review and TypeScript compiler parsing were attempted. A full project typecheck/build cannot be verified in this package-only environment because dependencies (`react`, `next`, `@google/genai`, etc.) are not installed locally; the compiler reports missing modules and built-in Node type definitions. Run `bun install` and `bun run build` in the user's environment before deploying. Android device testing has not been performed here.
