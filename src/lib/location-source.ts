import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

/** One GPS reading. `timestamp` is when the phone measured it, in milliseconds since 1970. */
export type Reading = { latitude: number; longitude: number; accuracy: number; timestamp: number };
export type ReadingError = "denied" | "unavailable";

let backgroundGeolocation: BackgroundGeolocationPlugin | undefined;

/**
 * Watches the GPS and returns a function that stops watching. In the Android app it keeps going
 * with the screen off or the app in the background (Android shows a notification while it runs);
 * in a browser it only works while the page is open.
 */
export function watchReadings(onReading: (reading: Reading) => void, onError: (error: ReadingError) => void) {
  if (!Capacitor.isNativePlatform()) return watchBrowser(onReading, onError);
  backgroundGeolocation ??= registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
  return watchNative(backgroundGeolocation, onReading, onError);
}

function watchBrowser(onReading: (reading: Reading) => void, onError: (error: ReadingError) => void) {
  if (!("geolocation" in navigator)) {
    queueMicrotask(() => onError("unavailable"));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    ({ coords, timestamp }) => onReading({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp }),
    (error) => onError(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
    { enableHighAccuracy: true, maximumAge: 5_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Android 13+ only shows the "location in use" notification with this permission. Sharing works either way. */
async function requestNotificationPermission() {
  await LocalNotifications.requestPermissions().catch(() => undefined);
}

/** The Android watcher. Exported so it can be tested with a fake plugin. */
export function watchNative(
  plugin: BackgroundGeolocationPlugin,
  onReading: (reading: Reading) => void,
  onError: (error: ReadingError) => void,
  prepare: () => Promise<void> = requestNotificationPermission,
) {
  let stopped = false;
  let watcherId: string | null = null;

  void (async () => {
    await prepare();
    if (stopped) return;
    try {
      const id = await plugin.addWatcher(
        {
          backgroundTitle: "SafePath",
          backgroundMessage: "Таны байршлыг асран хамгаалагчтайгаа хуваалцаж байна.",
          requestPermissions: true,
          stale: false,
        },
        (location, error) => {
          if (stopped) return;
          if (error) return onError(error.code === "NOT_AUTHORIZED" ? "denied" : "unavailable");
          if (location) {
            onReading({ latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, timestamp: location.time ?? Date.now() });
          }
        },
      );
      // Stopped while the watcher was starting: remove it, or its notification would stay forever.
      if (stopped) await plugin.removeWatcher({ id });
      else watcherId = id;
    } catch {
      if (!stopped) onError("unavailable");
    }
  })();

  return () => {
    stopped = true;
    if (watcherId) void plugin.removeWatcher({ id: watcherId });
  };
}

/**
 * Sends a location report. In the Android app it goes through native HTTP, because Android throttles
 * requests from a backgrounded WebView; it still carries the login cookie, as Capacitor's native HTTP
 * uses the WebView's cookie store.
 */
export async function postLocation(body: object, signal: AbortSignal): Promise<{ status: number; data: unknown }> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url: new URL("/api/location", window.location.href).href,
      headers: { "Content-Type": "application/json" },
      data: body,
    });
    return { status: response.status, data: response.data };
  }
  const response = await fetch("/api/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}
