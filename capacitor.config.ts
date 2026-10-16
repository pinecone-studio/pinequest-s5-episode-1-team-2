import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";

// To try local changes on a USB-connected phone without deploying:
//   adb reverse tcp:3001 tcp:3001
//   CAP_SERVER_URL=http://localhost:3001 npx cap sync android   (then build the APK)
// localhost counts as a secure origin, so camera and location still work over plain http.
const serverUrl = process.env.CAP_SERVER_URL ?? "https://safepath-indol.vercel.app";
const localServer = serverUrl.startsWith("http://localhost");
// Push needs Firebase: without android/app/google-services.json the push plugin's register() kills
// the whole app natively, so the plugin is only built in once that file is in place.
const firebaseReady = existsSync(join(process.cwd(), "android", "app", "google-services.json"));

const config: CapacitorConfig = {
  appId: "io.safepath.app",
  appName: "SafePath",
  webDir: "public",
  server: {
    // Temporary live Vercel hostname. Switch this to https://safepath.app once
    // the custom domain's DNS records have been applied and verified.
    url: serverUrl,
    cleartext: localServer,
    allowNavigation: ["safepath-indol.vercel.app", "safepath.app", "*.safepath.app", ...(localServer ? ["localhost"] : [])],
  },
  android: {
    // Required by the background-geolocation plugin: otherwise location updates stop after
    // about 5 minutes in the background.
    useLegacyBridge: true,
    // Android 15 draws apps edge-to-edge; without this the page slides under the status bar.
    adjustMarginsForEdgeToEdge: "auto",
    includePlugins: [
      "@capacitor-community/background-geolocation",
      "@capacitor/geolocation",
      "@capacitor/local-notifications",
      ...(firebaseReady ? ["@capacitor/push-notifications"] : []),
    ],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["alert", "sound"],
    },
  },
};

export default config;
