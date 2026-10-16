"use client";

import { useEffect } from "react";

/** Registers the service worker that keeps the child's screens usable with no mobile data. */
export default function OfflineSupport() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Without it the app still works online; only offline opening is lost.
    });
  }, []);
  return null;
}
