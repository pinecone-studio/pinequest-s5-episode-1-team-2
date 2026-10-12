# SafePath AR-style camera navigation visual update

This update restyles `src/components/ar-navigation-camera.tsx` to more closely match the supplied reference screenshot:

- Full camera preview as the background.
- Blue destination banner with destination name and remaining distance.
- Three perspective-styled blue/white route chevrons over the camera image.
- A short turn instruction above the bottom panel.
- A live OpenStreetMap mini-map at the bottom, showing the current route and its destination.
- Camera enable/disable button and readable camera permission errors.

## Apply

Unzip this update at the repository root and overwrite only the included files. Do not replace `.env.local` or project configuration. Then run:

```bash
bun run build
```

## Notes

The chevrons are a visual AR-style overlay whose direction is estimated from GPS route bearing and device compass heading. They are not world-anchored 3D objects and do not perform visual-inertial tracking. The mini-map requires an internet connection to load OpenStreetMap tiles. Camera access requires HTTPS or localhost and user permission. Use conventional map/voice guidance when compass data is unavailable or inaccurate.
