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
    // Push needs Firebase (android/app/google-services.json). Without it, the push plugin's
    // register() kills the whole app natively, so it stays out of the Android build until
    // Firebase is set up. Add "@capacitor/push-notifications" back here at the same time.
    includePlugins: [
      "@capacitor-community/background-geolocation",
      "@capacitor/geolocation",
      "@capacitor/local-notifications",
    ],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["alert", "sound"],
    },
  },
};

export default config;
