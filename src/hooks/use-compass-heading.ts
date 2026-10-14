"use client";

import { useEffect, useState } from "react";

type DeviceOrientationWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

// Exponential smoothing factor for the compass; lower is steadier but slower to react.
const HEADING_SMOOTHING = 0.18;

function readOrientation(event: DeviceOrientationWithCompass): number | null {
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)) {
    return (event.webkitCompassHeading + 360) % 360;
  }

  const { alpha, beta, gamma } = event;
  if (typeof alpha !== "number" || !Number.isFinite(alpha)) return null;

  if (typeof beta === "number" && Number.isFinite(beta) && typeof gamma === "number" && Number.isFinite(gamma)) {
    // Project the rear camera's direction (device -Z) onto the horizontal plane so the heading
    // matches where the camera points while the phone is held upright, regardless of screen rotation.
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const [a, b, g] = [radians(alpha), radians(beta), radians(gamma)];
    const east = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
    const north = Math.cos(a) * Math.sin(b) * Math.cos(g) - Math.sin(a) * Math.sin(g);
    if (Math.hypot(east, north) > 0.35) {
      return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
    }
  }

  // Phone is close to flat: fall back to the top edge's heading, accounting for screen rotation.
  const screenAngle = typeof window !== "undefined" ? (window.screen.orientation?.angle ?? 0) : 0;
  return ((360 - alpha + screenAngle) % 360 + 360) % 360;
}

/**
 * The direction the phone faces, in degrees clockwise from north, smoothed and published at most
 * once per frame. `problem` explains why there is no heading when the sensor cannot be read.
 * iOS needs DeviceOrientationEvent.requestPermission() from a tap before this receives anything.
 */
export function useCompassHeading(enabled: boolean): { heading: number | null; problem: string } {
  const [heading, setHeading] = useState<number | null>(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (!enabled) return;

    // Android Chrome's plain `deviceorientation` alpha is relative to an arbitrary start, so listening
    // to both events would make the heading jump. Use the absolute event alone when it exists.
    const supportsAbsolute = "ondeviceorientationabsolute" in window;
    const eventName = supportsAbsolute ? "deviceorientationabsolute" : "deviceorientation";
    let smoothed: { x: number; y: number } | null = null;
    let lastPublished: number | null = null;
    let frame = 0;

    const publish = () => {
      frame = 0;
      if (!smoothed) return;
      const next = ((Math.atan2(smoothed.x, smoothed.y) * 180) / Math.PI + 360) % 360;
      if (lastPublished !== null && Math.abs(((next - lastPublished + 540) % 360) - 180) < 1) return;
      lastPublished = next;
      setHeading(next);
    };

    const handleOrientation = (rawEvent: Event) => {
      const event = rawEvent as DeviceOrientationWithCompass;
      const isAbsolute = supportsAbsolute || event.absolute || typeof event.webkitCompassHeading === "number";
      const rawHeading = isAbsolute ? readOrientation(event) : null;
      if (rawHeading === null) {
        setProblem(isAbsolute
          ? "Луужинг уншиж чадсангүй. Утсаа 8 хэлбэрээр хөдөлгөж үзнэ үү."
          : "Энэ browser хойд зүгийг тодорхойлж чадахгүй байна. Газрын зургийн маршрутыг дагаарай.");
        return;
      }

      // Smooth on the unit circle so 359° → 1° does not swing through 180°.
      const radians = (rawHeading * Math.PI) / 180;
      const x = Math.sin(radians);
      const y = Math.cos(radians);
      smoothed = smoothed
        ? { x: smoothed.x + (x - smoothed.x) * HEADING_SMOOTHING, y: smoothed.y + (y - smoothed.y) * HEADING_SMOOTHING }
        : { x, y };
      setProblem("");
      if (!frame) frame = requestAnimationFrame(publish);
    };

    window.addEventListener(eventName, handleOrientation);
    return () => {
      window.removeEventListener(eventName, handleOrientation);
      if (frame) cancelAnimationFrame(frame);
      setHeading(null);
      setProblem("");
    };
  }, [enabled]);

  return { heading, problem };
}
