"use client";

import { useEffect, useState } from "react";
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
        setChildren(result.children as ChildLocation[]);
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
