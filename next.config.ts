import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Utsnaas LAN IP-aar dev server ruu orohod HMR/dev asset-uudig blocklohgui baih
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
