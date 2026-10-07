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

  const stopWatching = useCallback(() => {
    if (watchId.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      queueMicrotask(() => {
        setStatus("error");
        setError("Энэ төхөөрөмж байршил тодорхойлох боломжгүй байна.");
      });
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
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

    return stopWatching;
  }, [stopWatching]);

  const useDemoLocation = useCallback(() => {
    stopWatching();
    setLocation({ ...DEMO_LOCATION, lastUpdated: Date.now() });
    setStatus("demo");
    setError(null);
  }, [stopWatching]);

  return { location, status, error, useDemoLocation };
}
