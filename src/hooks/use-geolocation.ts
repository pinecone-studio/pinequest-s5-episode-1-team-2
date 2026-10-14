"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SafetyLocation } from "@/types/safety";

type GeolocationStatus = "loading" | "success" | "error" | "demo";

const DEMO_LOCATION: SafetyLocation = {
  latitude: 47.9189,
  longitude: 106.9176,
  accuracy: 20,
  lastUpdated: 0,
};

function getErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Байршлын зөвшөөрөл хаалттай байна. Төхөөрөмжийн тохиргооноос зөвшөөрнө үү.";
  }

  if (error.code === error.TIMEOUT) {
    return "Байршил авахад удаж байна. GPS-ээ шалгаад дахин оролдоно уу.";
  }

  return "Байршлыг тодорхойлж чадсангүй. GPS-ээ асаагаад дахин оролдоно уу.";
}

export function useGeolocation() {
  const [location, setLocation] = useState<SafetyLocation | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const hasRealLocation = useRef(false);
  const usingDemoLocation = useRef(false);

  const stopWatching = useCallback(() => {
    if (watchId.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (usingDemoLocation.current) return;
    stopWatching();

    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Энэ төхөөрөмж байршил тодорхойлох боломжгүй байна.");
      return;
    }

    if (!hasRealLocation.current) setStatus("loading");
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        hasRealLocation.current = true;
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          lastUpdated: position.timestamp || Date.now(),
        });
        setStatus("success");
        setError(null);
      },
      (positionError) => {
        setStatus("error");
        setError(getErrorMessage(positionError));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    );
  }, [stopWatching]);

  useEffect(() => {
    startWatching();
    let wasHidden = document.visibilityState === "hidden";

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
        return;
      }
      if (!wasHidden) return;
      wasHidden = false;
      // Restart the browser/WebView GPS watcher after returning from background so it
      // requests a fresh fix instead of leaving the UI stuck on an old location.
      startWatching();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) startWatching();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      stopWatching();
    };
  }, [startWatching, stopWatching]);

  const useDemoLocation = useCallback(() => {
    usingDemoLocation.current = true;
    stopWatching();
    setLocation({ ...DEMO_LOCATION, lastUpdated: Date.now() });
    setStatus("demo");
    setError(null);
  }, [stopWatching]);

  return { location, status, error, useDemoLocation };
}
