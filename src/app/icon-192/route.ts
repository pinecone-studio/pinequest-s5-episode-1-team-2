import { createElement } from "react";
import { ImageResponse } from "next/og";
import { PwaIconImage } from "@/components/pwa-icon-image";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(createElement(PwaIconImage, { size: 192 }), {
    width: 192,
    height: 192,
  });
}
