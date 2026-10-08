import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.safepath.app",
  appName: "SafePath",
  webDir: "public",
  server: {
    // Temporary live Vercel hostname. Switch this to https://safepath.app once
    // the custom domain's DNS records have been applied and verified.
    url: "https://safepath-indol.vercel.app",
    cleartext: false,
    allowNavigation: ["safepath-indol.vercel.app", "safepath.app", "*.safepath.app"],
  },
  android: {
    // Required by the background-geolocation plugin: otherwise location updates stop after
    // about 5 minutes in the background.
    useLegacyBridge: true,
  },
};

export default config;
