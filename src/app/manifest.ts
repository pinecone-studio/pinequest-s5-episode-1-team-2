import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SafePath AI | Аюулгүй хөтөч",
    short_name: "SafePath",
    description: "Хайртай хүмүүсээ аюулгүй байлгахад туслах хөтөч.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#071116",
    theme_color: "#071116",
    icons: [
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
