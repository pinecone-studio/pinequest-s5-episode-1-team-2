"use client";

import { useEffect, useState } from "react";

export type SharingStatus = "waiting" | "sharing" | "no-guardian" | "no-location" | "error" | "stopped";

/** At most one report this often, however fast new readings arrive. */
const MIN_GAP_MS = 10_000;

async function send(position: GeolocationPosition, signal: AbortSignal): Promise<SharingStatus> {
  const { latitude, longitude, accuracy } = position.coords;
  try {
    const response = await fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude, accuracy, ageMs: Math.max(0, Date.now() - position.timestamp) }),
      signal,
    });
    if (response.status === 401 || response.status === 403) return "stopped";
    if (!response.ok) return "error";
    const result: unknown = await response.json();
    return result && typeof result === "object" && "shared" in result && result.shared === true ? "sharing" : "no-guardian";
  } catch {
    return "error";
  }
}

/**
 * While the child's page is open, sends each new GPS reading (at most one every 10 s) so linked
 * guardians can see it. It watches the real GPS itself, so a demo-mode position is never sent, and
 * each report says how old its reading is, so a position that stopped updating never looks current.
 */
export function useLocationSharing() {
  const [status, setStatus] = useState<SharingStatus>("waiting");

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      queueMicrotask(() => setStatus("no-location"));
      return;
    }

    const controller = new AbortController();
    let latest: GeolocationPosition | null = null;
    let sentTimestamp = 0;
    let lastSendAt = 0;
    let sending = false;
    let timer: number | undefined;

    function schedule() {
      if (timer !== undefined || sending || !latest || latest.timestamp === sentTimestamp) return;
      timer = window.setTimeout(flush, Math.max(0, lastSendAt + MIN_GAP_MS - Date.now()));
    }

    async function flush() {
      timer = undefined;
      if (!latest) return;
      const reading = latest;
      sending = true;
      sentTimestamp = reading.timestamp;
      lastSendAt = Date.now();
      const next = await send(reading, controller.signal);
      sending = false;
      if (controller.signal.aborted) return;
      setStatus(next);
      if (next === "stopped") return navigator.geolocation.clearWatch(watchId);
      if (next === "error") sentTimestamp = 0; // try this reading again after the gap
      schedule(); // a newer reading may have arrived while sending
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        latest = position;
        schedule();
      },
      (error) => {
        // A dropout after a good reading is fine: the last reading keeps its true age.
        if (!latest || error.code === error.PERMISSION_DENIED) setStatus("no-location");
      },
      { enableHighAccuracy: true, maximumAge: 5_000 },
    );

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return status;
}
