import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "SafePath AI | Аюулгүй хөтөч",
  description: "Хайртай хүмүүсээ аюулгүй байлгахад туслах хөтөч.",
  appleWebApp: {
    capable: true,
    title: "SafePath",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#071116",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mn" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
