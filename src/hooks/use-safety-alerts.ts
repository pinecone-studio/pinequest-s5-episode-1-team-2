"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuardianSafetyAlert } from "@/types/alerts";

const POLL_MS = 10_000;

function isAlert(value: unknown): value is GuardianSafetyAlert {
  if (!value || typeof value !== "object") return false;
  const alert = value as Partial<GuardianSafetyAlert>;
  return typeof alert.id === "string"
    && typeof alert.childId === "string"
    && typeof alert.childName === "string"
    && (alert.type === "OUTSIDE_SAFE_ZONES" || alert.type === "ZONE_EXIT" || alert.type === "ZONE_ENTER" || alert.type === "SOS")
    && (typeof alert.zoneName === "string" || alert.zoneName === null)
    && typeof alert.message === "string"
    && typeof alert.createdAt === "string"
    && typeof alert.read === "boolean";
}

/** Polls in-app alerts while the guardian dashboard is open. */
export function useSafetyAlerts() {
  const [alerts, setAlerts] = useState<GuardianSafetyAlert[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timeout: number | undefined;
    let controller: AbortController | null = null;

    async function poll() {
      controller = new AbortController();
      try {
        const response = await fetch("/api/alerts", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load safety alerts.");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("alerts" in result) || !Array.isArray(result.alerts)) {
          throw new Error("Invalid safety alert response.");
        }
        if (!result.alerts.every(isAlert)) throw new Error("Invalid safety alert item.");
        if (!stopped) {
          setAlerts(result.alerts as GuardianSafetyAlert[]);
          setFailed(false);
        }
      } catch {
        if (!stopped && !controller.signal.aborted) setFailed(true);
      } finally {
        if (!stopped) timeout = window.setTimeout(() => void poll(), POLL_MS);
      }
    }

    void poll();
    return () => {
      stopped = true;
      controller?.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  const markRead = useCallback(async (alertId: string) => {
    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      if (!response.ok) throw new Error("Could not mark safety alert as read.");
      setAlerts((current) => current.map((alert) => alert.id === alertId ? { ...alert, read: true } : alert));
      setFailed(false);
      return true;
    } catch {
      setFailed(true);
      return false;
    }
  }, []);

  return { alerts, failed, markRead };
}
