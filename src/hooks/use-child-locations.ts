"use client";

import { useEffect, useRef, useState } from "react";
import type { ChildLocation } from "@/types/location";

/** How often the guardian's page asks for fresh positions. */
const POLL_MS = 5_000;

/**
 * The guardian's linked children and their latest positions, refreshed every few seconds.
 * `children` is null until the first answer arrives. `checkedAt` is when that answer came,
 * so the page can say how old a position is without reading the clock while rendering.
 */
export function useChildLocations() {
  const [children, setChildren] = useState<ChildLocation[] | null>(null);
  const [checkedAt, setCheckedAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const previous = useRef(new Map<string, { latitude: number; longitude: number; at: number }>());

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;

    async function poll() {
      try {
        const response = await fetch("/api/location", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Location request failed.");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("children" in result) || !Array.isArray(result.children)) {
          throw new Error("Invalid location response.");
        }
        const incoming = result.children as ChildLocation[];
        const nextPrevious = new Map(previous.current);
        const enriched = incoming.map((child) => {
          const position = child.position;
          if (!position) {
            nextPrevious.delete(child.childId);
            return { ...child, speedKmh: null };
          }
          const at = new Date(position.updatedAt).getTime();
          const prior = nextPrevious.get(child.childId);
          let speedKmh: number | null = null;
          if (prior && at > prior.at) {
            const rad = (degrees: number) => degrees * Math.PI / 180;
            const dLat = rad(position.latitude - prior.latitude);
            const dLon = rad(position.longitude - prior.longitude);
            const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(rad(prior.latitude)) * Math.cos(rad(position.latitude)) *
              Math.sin(dLon / 2) ** 2;
            const meters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const hours = (at - prior.at) / 3_600_000;
            const speed = meters / 1000 / hours;
            // GPS jumps / stale readings are not useful as a speed estimate.
            if (Number.isFinite(speed) && speed <= 160) speedKmh = Math.round(speed * 10) / 10;
          }
          nextPrevious.set(child.childId, { latitude: position.latitude, longitude: position.longitude, at });
          return { ...child, speedKmh };
        });
        previous.current = nextPrevious;
        setChildren(enriched);
        setCheckedAt(Date.now());
        setFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
      }
      if (!controller.signal.aborted) timer = window.setTimeout(poll, POLL_MS);
    }

    void poll();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return { children, checkedAt, failed };
}
