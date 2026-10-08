"use client";

import { useCallback, useEffect, useState } from "react";
import type { SharingState } from "@/types/location";

export type SharingStatus = "waiting" | "sharing" | "no-guardian" | "no-location" | "error" | "stopped";

/** At most one report this often, however fast new readings arrive. */
const MIN_GAP_MS = 10_000;

async function send(position: GeolocationPosition, signal: AbortSignal): Promise<{ status: SharingStatus; state?: SharingState }> {
  const { latitude, longitude, accuracy } = position.coords;
  try {
    const response = await fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude, accuracy, ageMs: Math.max(0, Date.now() - position.timestamp) }),
      signal,
    });
    if (response.status === 401 || response.status === 403) return { status: "stopped" };
    if (!response.ok) return { status: "error" };
    const result = (await response.json()) as Partial<SharingState & { shared: boolean }>;
    const state = { paused: result.paused === true, watchers: typeof result.watchers === "number" ? result.watchers : 0 };
    return { status: result.shared === true ? "sharing" : "no-guardian", state };
  } catch {
    return { status: "error" };
  }
}

/**
 * While the child's page is open and sharing is not paused, sends each new GPS reading (at most one
 * every 10 s) so linked guardians can see it. It first asks the server whether sharing is paused, so a
 * paused phone never sends a position. It watches the real GPS itself, so a demo-mode position is never
 * sent, and each report says how old its reading is, so a position that stopped updating never looks current.
 */
export function useLocationSharing() {
  const [status, setStatus] = useState<SharingStatus>("waiting");
  /** null until the server says whether sharing is paused. */
  const [sharing, setSharing] = useState<SharingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const paused = sharing?.paused;

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;

    async function load() {
      try {
        const response = await fetch("/api/location/sharing", { cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) return setStatus("stopped");
        if (!response.ok) throw new Error("Sharing state request failed.");
        setSharing((await response.json()) as SharingState);
      } catch {
        if (controller.signal.aborted) return;
        setStatus("error");
        timer = window.setTimeout(load, MIN_GAP_MS);
      }
    }

    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (paused !== false) return;
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
      const result = await send(reading, controller.signal);
      sending = false;
      if (controller.signal.aborted) return;
      setStatus(result.status);
      if (result.state) setSharing(result.state); // a pause made on another device stops this watch
      if (result.status === "stopped") return navigator.geolocation.clearWatch(watchId);
      if (result.status === "error") sentTimestamp = 0; // try this reading again after the gap
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
  }, [paused]);

  const setPaused = useCallback(async (next: boolean) => {
    setSaving(true);
    setSaveFailed(false);
    try {
      const response = await fetch("/api/location/sharing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      if (!response.ok) throw new Error("Could not change sharing.");
      setSharing((await response.json()) as SharingState);
      setStatus("waiting");
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, []);

  return { status, sharing, saving, saveFailed, setPaused };
}
