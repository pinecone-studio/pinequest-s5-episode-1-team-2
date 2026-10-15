"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaceDescription } from "@/lib/reverse-geocode";

/** Ask for a new address only after the child has moved this far, so polling does not spam lookups. */
const MOVE_METERS = 25;

type Position = { latitude: number; longitude: number };

function metersBetween(a: Position, b: Position) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** The selected child's position in words, refreshed as they move. */
export function useChildAddress(childId: string | null, position: Position | null) {
  const [address, setAddress] = useState<PlaceDescription | null>(null);
  const [failed, setFailed] = useState(false);
  const lookedUp = useRef<{ childId: string; position: Position } | null>(null);
  const latitude = position?.latitude;
  const longitude = position?.longitude;

  useEffect(() => {
    if (!childId || latitude === undefined || longitude === undefined) return;
    const current = { latitude, longitude };
    const previous = lookedUp.current;
    if (previous && previous.childId === childId && metersBetween(previous.position, current) < MOVE_METERS) return;

    const controller = new AbortController();
    const changedChild = previous?.childId !== childId;
    const mark = { childId, position: current };
    lookedUp.current = mark;
    let inFlight = true;

    void (async () => {
      if (changedChild) setAddress(null);
      try {
        const response = await fetch(`/api/location/address?childId=${encodeURIComponent(childId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Address request failed.");
        const result: unknown = await response.json();
        const next = result && typeof result === "object" && "address" in result ? (result.address as PlaceDescription | null) : null;
        setAddress(next);
        setFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        // Try again on the next position update rather than keeping a wrong "looked up" mark.
        lookedUp.current = null;
        setFailed(true);
      } finally {
        inFlight = false;
      }
    })();

    return () => {
      // Only an unfinished lookup is cancelled and forgotten; a finished one stays as the baseline.
      if (!inFlight) return;
      controller.abort();
      if (lookedUp.current === mark) lookedUp.current = null;
    };
  }, [childId, latitude, longitude]);

  return { address, failed };
}
