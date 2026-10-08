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
};

export default config;
