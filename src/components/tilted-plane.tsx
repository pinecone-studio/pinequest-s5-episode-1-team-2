import type { ReactNode } from "react";

/**
 * Lays its child (a map) down as ground seen from a low, slanted angle, like a navigation app's
 * 3D view. The child's centre appears at `centerPercent` of the frame's height, so overlays placed
 * there still line up with the map's centre.
 */
export function TiltedPlane({
  children,
  tilt = 58,
  centerPercent = 62,
  fadeColor = "#101c22",
}: {
  children: ReactNode;
  tilt?: number;
  centerPercent?: number;
  fadeColor?: string;
}) {
  // The plane is taller and wider than the frame so its tilted edges never show.
  const halfHeight = 220;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ perspective: "520px", perspectiveOrigin: `50% ${centerPercent}%` }}>
      <div
        className="absolute"
        style={{
          left: "-45%",
          right: "-45%",
          top: `${centerPercent - halfHeight}%`,
          bottom: `${100 - centerPercent - halfHeight}%`,
          transform: `rotateX(${tilt}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        {children}
      </div>
      {/* Fade the far edge into the sky so the horizon does not end in a hard line. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[401] h-[42%]"
        style={{ background: `linear-gradient(to bottom, ${fadeColor}, ${fadeColor}cc 40%, transparent)` }}
      />
      {/* The tilt pushes the map's own corners off-screen, so the required credit lives here. */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-3 z-[402] rounded-lg bg-white/85 px-1.5 py-0.5 text-[10px] text-[#737373]"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
