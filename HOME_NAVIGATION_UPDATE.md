SafePath — Home Navigation update

This patch adds:
- Walking route calculation to the configured "Гэр" safe zone.
- Route line on the companion map.
- Dynamic next-turn instruction.
- Home distance display.
- Existing Gemini assistant receives the navigation instruction and speaks it through the existing TTS flow.

Files:
- src/app/api/route/route.ts
- src/app/tracker/page.tsx
- src/components/live-map.tsx

Important:
- Keep your existing .env.local; it is intentionally NOT included.
- The route service used by this prototype is Valhalla/OpenStreetMap.
