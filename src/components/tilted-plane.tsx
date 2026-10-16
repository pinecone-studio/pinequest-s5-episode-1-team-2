"use client";

import { useState, type ReactNode } from "react";

/**
 * Lays its child (a map) down as ground seen from a low, slanted angle, like a navigation app's
 * 3D view. The child's centre appears at `centerPercent` of the frame's height, so overlays placed
 * there still line up with the map's centre. With a `heading` (degrees from north), the ground
 * turns so the direction the person faces always points up the screen.
 */
export function TiltedPlane({
  children,
  tilt = 58,
  centerPercent = 62,
  heading = null,
  fadeColor = "#101c22",
}: {
  children: ReactNode;
  tilt?: number;
  centerPercent?: number;
  heading?: number | null;
  fadeColor?: string;
}) {
  // Keep a running angle instead of the raw 0–360° heading, so the eased turn from 359° to 1°
  // takes the short 2° step rather than spinning the whole map around.
  const [turn, setTurn] = useState<{ heading: number | null; angle: number }>({ heading, angle: heading ?? 0 });
  if (heading !== null && heading !== turn.heading) {
    const step = turn.heading === null ? heading - turn.angle : ((heading - turn.heading + 540) % 360) - 180;
    setTurn({ heading, angle: turn.angle + step });
  }
  const angle = heading === null ? 0 : turn.angle;

  // A square plane big enough to cover the frame out to the horizon at any rotation: half its side
  // is the larger of 2.2× the frame's height (the far reach once tilted) and its full width.
  const halfSide = "max(220cqh, 100cqw)";
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ containerType: "size", perspective: "520px", perspectiveOrigin: `50% ${centerPercent}%` }}
    >
      <div
        className="absolute"
        style={{
          width: `calc(2 * ${halfSide})`,
          height: `calc(2 * ${halfSide})`,
          left: `calc(50cqw - ${halfSide})`,
          top: `calc(${centerPercent}cqh - ${halfSide})`,
          transform: `rotateX(${tilt}deg) rotateZ(${(-angle).toFixed(1)}deg)`,
          transformOrigin: "50% 50%",
          transition: "transform 300ms ease-out",
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

/** "You are here, facing up" marker for maps that turn with the compass. */
export function HeadingArrow() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 drop-shadow-[0_2px_3px_rgba(0,0,0,.35)]">
      <path d="M16 3 27 27 16 21 5 27Z" fill="#2a7fff" stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}
