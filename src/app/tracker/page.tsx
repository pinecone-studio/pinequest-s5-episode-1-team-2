"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Settings, Volume2, VolumeX, WifiOff } from "lucide-react";
import { LocationSharingStatus } from "@/components/location-sharing-status";
import ArNavigationCamera from "@/components/ar-navigation-camera";
import { AppShell, CompanionMark } from "@/components/safe-path";
import { SafePathLoading } from "@/components/safepath-loading";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { toCompanionProfile } from "@/lib/assistant-settings";
import { getSafetyFallback } from "@/lib/ai/fallback-messages";
import { calculateSafetyState } from "@/lib/risk-engine";
import { getSafeZoneProximities } from "@/lib/geofence";
import { SAFE_ZONES } from "@/lib/safe-zones";
import type { SafeZone, SafetyAssistantRequest, SafetyState } from "@/types/safety";

const CompanionMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => <SafePathLoading className="absolute inset-x-4 bottom-5 rounded-xl bg-[#071116]/85" label="Газрын зураг ачаалж байна…" />,
});


type SpeechStatus = "idle" | "loading" | "playing" | "error";

// Guidance starts by itself once the person has clearly left the Safe Zone, and ends once they
// are clearly back. The short waits stop GPS jitter at the boundary from flicking the camera.
const GUIDANCE_START_DELAY_MS = 5_000;
const GUIDANCE_STOP_DELAY_MS = 15_000;
// Holding the logo this long toggles Demo Mode, kept out of sight of children and older users.
const DEMO_TOGGLE_HOLD_MS = 1_200;

type RouteResult = {
  destination: {
    latitude: number;
    longitude: number;
  };
  route: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
  nextInstruction: string;
};

export default function TrackerPage() {
  const {
    location,
    status: locationStatus,
    error: locationError,
  } = useGeolocation();
  const isOnline = useNetworkStatus();

  const { settings } = useAssistantSettings();

  

  const [demoMode, setDemoMode] = useState(false);
  const demoHoldTimer = useRef<number | null>(null);
  const [guiding, setGuiding] = useState(false);
  const [savedZones, setSavedZones] = useState<SafeZone[]>([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [zonesLoadError, setZonesLoadError] = useState("");
  const [sosConfirm, setSosConfirm] = useState(false);
  const [sosStatus, setSosStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sosMessage, setSosMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadSavedZones() {
      try {
        const response = await fetch("/api/tracker/safe-zones", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Safe zones could not be loaded.");
        const payload: unknown = await response.json();
        if (
          !payload ||
          typeof payload !== "object" ||
          !("zones" in payload) ||
          !isSafeZoneList(payload.zones)
        ) {
          throw new Error("Invalid safe-zone response.");
        }
        if (active) {
          setSavedZones(payload.zones);
          setZonesLoadError("");
        }
      } catch {
        if (!controller.signal.aborted && active) {
          setZonesLoadError("Аюулгүй бүсүүдийг ачаалж чадсангүй. Интернэтээ шалгана уу.");
        }
      } finally {
        if (active) setZonesLoaded(true);
      }
    }

    void loadSavedZones();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const [demoLocation, setDemoLocation] = useState({
    latitude: SAFE_ZONES[0].latitude,
    longitude: SAFE_ZONES[0].longitude,
    accuracy: 5,
    lastUpdated: 0,
  });



  const [assistantMessage, setAssistantMessage] = useState("");

  const [assistantLoading, setAssistantLoading] = useState(false);

  const [speechStatus, setSpeechStatus] =
    useState<SpeechStatus>("idle");

  const [speechError, setSpeechError] = useState("");

  const [route, setRoute] =
    useState<RouteResult | null>(null);

  const [routeStatus, setRouteStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle");


  const routeController =
    useRef<AbortController | null>(null);

  const lastRouteAt =
    useRef(0);

  const lastRouteTargetId =
    useRef<string | null>(null);

  const lastAutomaticRequest =
    useRef<string | null>(null);

  const requestSequence =
    useRef(0);

  const requestController =
    useRef<AbortController | null>(null);

  const speechSequence =
    useRef(0);

  const speechController =
    useRef<AbortController | null>(null);

  const speechCache =
    useRef(new Map<string, string>());

  const audioElement =
    useRef<HTMLAudioElement | null>(null);


  const profile = useMemo(
    () => toCompanionProfile(settings),
    [settings],
  );

  const currentLocation =
    demoMode
      ? demoLocation
      : location;
  const currentLatitude = currentLocation?.latitude;
  const currentLongitude = currentLocation?.longitude;
  const activeZones = demoMode ? SAFE_ZONES : savedZones;
  const targetZone = useMemo(() => {
    if (!currentLocation || activeZones.length === 0) return null;
    return getSafeZoneProximities(currentLocation, activeZones)[0]?.zone ?? null;
  }, [activeZones, currentLocation]);

  const sendSos = useCallback(async () => {
    if (demoMode || sosStatus === "sending") return;
    setSosStatus("sending");
    setSosMessage("SOS дохио илгээж байна…");
    try {
      const response = await fetch("/api/sos", { method: "POST", cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "SOS хүсэлтийн хариуг уншиж чадсангүй.";
      if (!response.ok) throw new Error(message);
      setSosStatus("sent");
      setSosMessage(message);
      setSosConfirm(false);
    } catch (error) {
      setSosStatus("error");
      setSosMessage(error instanceof Error ? error.message : "SOS дохио илгээж чадсангүй.");
    }
  }, [demoMode, sosStatus]);

  const moveDemoLocation = useCallback(
    (
      direction:
        | "up"
        | "down"
        | "left"
        | "right",
    ) => {
      setDemoLocation((current) => {
      
        const step = 0.001;

        let latitude = current.latitude;
        let longitude = current.longitude;

        if (direction === "up") {
          latitude += step;
        }

        if (direction === "down") {
          latitude -= step;
        }

        if (direction === "left") {
          longitude -= step;
        }

        if (direction === "right") {
          longitude += step;
        }

        return {
          ...current,
          latitude,
          longitude,
          lastUpdated: Date.now(),
        };
      });
    },
    [],
  );

  const routeDeviation = false;

  const safetyState = useMemo(
    () =>
      currentLocation && activeZones.length > 0
        ? calculateSafetyState({
            location: currentLocation,
            safeZones: activeZones,
            routeDeviation,
          })
        : null,
    [activeZones, currentLocation, routeDeviation],
  );

  const navigationInstruction =
    safetyState && !safetyState.isInsideSafeZone && targetZone
      ? route?.nextInstruction
      : undefined;


  // Outside a configured Safe Zone, the screen turns into camera guidance with the companion on
  // top; back inside, it returns to the calm map. Both switches wait a moment to ride out GPS jitter.
  const isOutsideSafeZone = Boolean(safetyState && targetZone && !safetyState.isInsideSafeZone);
  useEffect(() => {
    if (isOutsideSafeZone === guiding) return;
    const timer = window.setTimeout(
      () => setGuiding(isOutsideSafeZone),
      isOutsideSafeZone ? GUIDANCE_START_DELAY_MS : GUIDANCE_STOP_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [guiding, isOutsideSafeZone]);

  const startDemoHold = () => {
    demoHoldTimer.current = window.setTimeout(() => setDemoMode((value) => !value), DEMO_TOGGLE_HOLD_MS);
  };
  const cancelDemoHold = () => {
    if (demoHoldTimer.current) window.clearTimeout(demoHoldTimer.current);
    demoHoldTimer.current = null;
  };

  useEffect(() => {
    if (currentLatitude === undefined || currentLongitude === undefined) {
      return;
    }

    if (!targetZone) {
      routeController.current?.abort();
      lastRouteAt.current = 0;
      lastRouteTargetId.current = null;
      setRoute(null);
      setRouteStatus("idle");
      return;
    }

    if (safetyState?.isInsideSafeZone) {
      routeController.current?.abort();
      lastRouteAt.current = 0;
      setRoute(null);
      setRouteStatus("idle");
      return;
    }

    const now = Date.now();
    const targetChanged = lastRouteTargetId.current !== targetZone.id;

    if (
      !demoMode &&
      !targetChanged &&
      lastRouteAt.current !== 0 &&
      now - lastRouteAt.current < 10_000
    ) {
      return;
    }

    lastRouteTargetId.current = targetZone.id;
    lastRouteAt.current = now;
    routeController.current?.abort();

    const controller = new AbortController();
    routeController.current = controller;
    setRouteStatus("loading");

    const origin = {
      lat: currentLatitude,
      lon: currentLongitude,
    };

    const destination = {
      lat: targetZone.latitude,
      lon: targetZone.longitude,
    };

    const isValidRoute = (value: unknown): value is RouteResult => {
      if (!value || typeof value !== "object") return false;
      const result = value as Partial<RouteResult>;
      return (
        Array.isArray(result.route) &&
        result.route.length >= 2 &&
        result.route.every(
          (point) =>
            Array.isArray(point) &&
            point.length === 2 &&
            Number.isFinite(point[0]) &&
            Number.isFinite(point[1]),
        ) &&
        typeof result.nextInstruction === "string"
      );
    };

    const fetchAppRoute = async (): Promise<RouteResult> => {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin,
          destination,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Route API ${response.status}`);
      }

      const result: unknown = await response.json();

      if (!isValidRoute(result)) {
        throw new Error("Invalid route response");
      }

      return result;
    };

    const fetchFallbackRoute = async (): Promise<RouteResult> => {
      const coordinates = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
      const url =
        `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
        `?overview=full&geometries=geojson&steps=true`;

      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Fallback route ${response.status}`);
      }

      const data = await response.json();
      const osrmRoute = data?.routes?.[0];
      const geometry = osrmRoute?.geometry?.coordinates;

      if (!Array.isArray(geometry) || geometry.length < 2) {
        throw new Error("Fallback route has no geometry");
      }

      const points: [number, number][] = geometry
        .filter(
          (point: unknown) =>
            Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(point[0]) &&
            Number.isFinite(point[1]),
        )
        .map(
          (point: [number, number]) =>
            [point[1], point[0]] as [number, number],
        );

      if (points.length < 2) {
        throw new Error("Fallback route geometry is invalid");
      }

      const step =
        osrmRoute.legs?.[0]?.steps?.[0];
      const maneuver = step?.maneuver;
      const modifier =
        typeof maneuver?.modifier === "string"
          ? maneuver.modifier
          : "";

      const instruction =
        modifier === "right"
          ? "Баруун тийш эргээрэй."
          : modifier === "left"
            ? "Зүүн тийш эргээрэй."
            : modifier === "straight"
              ? "Энэ замаараа урагшаа яваарай."
              : "Буцах замаараа тайван яваарай.";

      return {
        destination: {
          latitude: destination.lat,
          longitude: destination.lon,
        },
        route: points,
        distanceMeters:
          typeof osrmRoute.distance === "number"
            ? osrmRoute.distance
            : null,
        durationSeconds:
          typeof osrmRoute.duration === "number"
            ? osrmRoute.duration
            : null,
        nextInstruction: instruction,
      };
    };

    void fetchAppRoute()
      .catch(async (error) => {
        if (controller.signal.aborted) throw error;
        console.warn("/api/route failed, using fallback route:", error);
        return fetchFallbackRoute();
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setRoute(result);
        setRouteStatus("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("ROUTE ERROR:", error);
        setRoute(null);
        setRouteStatus("error");
      });
  }, [currentLatitude, currentLongitude, demoMode, safetyState?.isInsideSafeZone, targetZone?.id, targetZone?.latitude, targetZone?.longitude]);

  useEffect(() => {
    return () => {
      routeController.current?.abort();
    };
  }, []);

  const speakMessage = useCallback(
    async (message: string) => {
      const text = message.trim();

      if (!text) {
        setSpeechStatus("error");
        setSpeechError(
          "Дуу тоглуулах боломжгүй байна.",
        );
        return;
      }

      const sequence =
        ++speechSequence.current;

      speechController.current?.abort();

      const controller =
        new AbortController();

      speechController.current =
        controller;

      const cacheKey =
        `${profile.voice}\u0000` +
        `${settings.speechSpeed}\u0000` +
        text;

      const audio =
        audioElement.current;

      audio?.pause();

      if (audio) {
        audio.currentTime = 0;
      }

      setSpeechError("");

      try {
        let audioUrl =
          speechCache.current.get(
            cacheKey,
          );

        if (!audioUrl) {
          setSpeechStatus("loading");

          const response =
            await fetch("/api/tts", {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                text,
                voice: profile.voice,
              }),
              signal:
                controller.signal,
            });

          if (!response.ok) {
            throw new Error(
              "Speech generation failed.",
            );
          }

          const blob =
            await response.blob();

          if (
            !blob.size ||
            !blob.type.startsWith(
              "audio/",
            )
          ) {
            throw new Error(
              "Invalid audio response.",
            );
          }

          audioUrl =
            URL.createObjectURL(
              blob,
            );

          speechCache.current.set(
            cacheKey,
            audioUrl,
          );
        }

        if (
          sequence !==
          speechSequence.current
        ) {
          return;
        }

        const currentAudio =
          audioElement.current;

        if (!currentAudio) {
          throw new Error(
            "Audio playback is unavailable.",
          );
        }

        setSpeechStatus("idle");

        currentAudio.src =
          audioUrl;

        currentAudio.currentTime =
          0;

        currentAudio.playbackRate =
          settings.speechSpeed ===
          "Удаан"
            ? 0.86
            : 1;

        await currentAudio.play();

        if (
          sequence ===
          speechSequence.current
        ) {
          setSpeechStatus(
            "playing",
          );
        }
      } catch {
        if (
          sequence !==
          speechSequence.current
        ) {
          return;
        }

        setSpeechStatus("error");

        setSpeechError(
          "Дуу тоглуулах боломжгүй байна.",
        );
      } finally {
        if (
          sequence ===
          speechSequence.current
        ) {
          speechController.current =
            null;
        }
      }
    },
    [
      profile.voice,
      settings.speechSpeed,
    ],
  );


  const requestAssistantMessage =
    useCallback(
      async (state: SafetyState) => {
        const sequence =
          ++requestSequence.current;

        requestController.current?.abort();

        const controller =
          new AbortController();

        requestController.current =
          controller;

        // Outside the zone the guidance screen is open, so even the offline message should
        // point the way home rather than say that everything is fine.
        const fallbackMessage =
          !state.isInsideSafeZone && targetZone
            ? getGuidanceFallback(targetZone.name)
            : getSafetyFallback(
                state.riskLevel,
                profile.userName,
              );

        speechSequence.current += 1;

        speechController.current?.abort();

        speechController.current =
          null;

        audioElement.current?.pause();

        if (audioElement.current) {
          audioElement.current.currentTime =
            0;
        }

        setSpeechStatus("idle");
        setSpeechError("");

        setAssistantMessage(
          fallbackMessage,
        );

        setAssistantLoading(true);

        const input:
          SafetyAssistantRequest = {
          ...profile,

          riskLevel:
            state.riskLevel,

          riskScore:
            state.riskScore,

          insideSafeZone:
            state.isInsideSafeZone,

          routeDeviationMeters:
            state.routeDeviation
              ? null
              : 0,

          nearestSafeZone:
            state.nearestSafeZone
              .name,

          distanceFromSafeZone:
            state.distanceToNearestZoneMeters,

          destination:
            targetZone?.name ?? state.nearestSafeZone.name,

          nearbyLandmarks: [],

          ...(navigationInstruction
            ? {
                navigationInstruction,
              }
            : {}),
        };

        try {
          const response =
            await fetch(
              "/api/assistant",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify(input),

                signal:
                  controller.signal,
              },
            );

          if (!response.ok) {
            throw new Error(
              "Assistant request failed.",
            );
          }

          const result: unknown =
            await response.json();

          if (
            !result ||
            typeof result !==
              "object" ||
            !("message" in result) ||
            typeof result.message !==
              "string" ||
            !result.message.trim()
          ) {
            throw new Error(
              "Assistant returned an empty message.",
            );
          }

          if (
            sequence ===
            requestSequence.current
          ) {
            setAssistantMessage(
              result.message.trim(),
            );

            void speakMessage(
              result.message.trim(),
            );
          }
        } catch {
          if (
            sequence ===
            requestSequence.current
          ) {
            setAssistantMessage(
              fallbackMessage,
            );

            void speakMessage(
              fallbackMessage,
            );
          }
        } finally {
          if (
            sequence ===
            requestSequence.current
          ) {
            setAssistantLoading(
              false,
            );
          }
        }
      },
      [
        navigationInstruction,
        profile,
        speakMessage,
        targetZone,
      ],
    );

  const automaticRequestKey =
    safetyState &&
    !safetyState.isInsideSafeZone &&
    targetZone &&
    routeStatus === "ready"
      ? [
          safetyState.riskLevel,
          safetyState.routeDeviation,
          targetZone.id,
          navigationInstruction ?? "",
        ].join(":")
      : null;

  useEffect(() => {
    if (!safetyState || !targetZone) return;

    if (safetyState.isInsideSafeZone) {
      const safeKey = `inside:${targetZone.id}`;
      if (lastAutomaticRequest.current === safeKey) return;
      lastAutomaticRequest.current = safeKey;
      requestSequence.current += 1;
      requestController.current?.abort();
      speechSequence.current += 1;
      speechController.current?.abort();
      audioElement.current?.pause();
      if (audioElement.current) audioElement.current.currentTime = 0;
      setAssistantLoading(false);
      setSpeechStatus("idle");
      setSpeechError("");
      setAssistantMessage(`Та ${targetZone.name} аюулгүй бүсэд байна. Тайван байгаарай.`);
      return;
    }

    if (!safetyState.isInsideSafeZone && routeStatus === "error") {
      const routeErrorKey = `route-error:${targetZone.id}:${safetyState.riskLevel}`;
      if (lastAutomaticRequest.current !== routeErrorKey) {
        lastAutomaticRequest.current = routeErrorKey;
        void requestAssistantMessage(safetyState);
      }
      return;
    }

    if (
      !automaticRequestKey ||
      lastAutomaticRequest.current === automaticRequestKey
    ) return;

    lastAutomaticRequest.current = automaticRequestKey;
    void requestAssistantMessage(safetyState);
  }, [automaticRequestKey, requestAssistantMessage, routeStatus, safetyState, targetZone]);


  useEffect(() => {
    const audio = audioElement.current;
    const cachedSpeech = speechCache.current;

    return () => {
      requestController.current?.abort();

      speechController.current?.abort();

      audio?.pause();

      cachedSpeech.forEach(
        (url) => {
          URL.revokeObjectURL(url);
        },
      );
    };
  }, []);


  const companionName = settings.name || "Мило";
  const companionMessage = assistantMessage || (safetyState
    ? isOutsideSafeZone && targetZone
      ? getGuidanceFallback(targetZone.name)
      : getSafetyFallback(safetyState.riskLevel, profile.userName)
    : zonesLoadError || (zonesLoaded && !demoMode && savedZones.length === 0
      ? "Асран хамгаалагчаасаа аюулгүй бүс тохируулж өгөхийг хүсээрэй."
      : "Байршил болон аюулгүй бүс ачаалж байна…"));
  const companionState = safetyState?.riskLevel === "HIGH_RISK" || safetyState?.riskLevel === "WARNING"
    ? "warning"
    : speechStatus === "playing"
      ? "speaking"
      : "idle";

  return (
    <AppShell>
      <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-linear-to-b from-[#071116] via-[#0b151b] to-[#050a0e] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-[12%] size-64 rounded-full bg-[#06b6d4]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-[#0e7490]/20 blur-3xl" />

        <header className="relative z-10 flex min-h-14 items-center justify-between gap-2">
          {/* Holding the logo toggles Demo Mode for presentations; a plain tap does nothing. */}
          <div
            onPointerDown={startDemoHold}
            onPointerUp={cancelDemoHold}
            onPointerLeave={cancelDemoHold}
            onPointerCancel={cancelDemoHold}
            onContextMenu={(event) => event.preventDefault()}
            className="inline-flex select-none items-center gap-2 text-[17px] font-bold tracking-[-0.02em]"
          >
            <span className="grid size-8 place-items-center rounded-xl bg-[#0e7490] text-[#cffafe]"><MapPin size={17} fill="currentColor" /></span>
            SafePath
            {demoMode && <span className="rounded-full bg-[#0e7490] px-2 py-0.5 text-[11px] font-bold">DEMO</span>}
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-2.5 py-1 text-[12px] font-bold text-amber-950">
                <WifiOff size={13} aria-hidden="true" /> Интернетгүй
              </span>
            )}
            <Link
              href="/tracker/code"
              aria-label="Тохиргоо"
              className="grid size-11 place-items-center rounded-full text-[#b7c7cc] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
            >
              <Settings size={20} />
            </Link>
          </div>
        </header>

        {demoMode && (
          <div className="relative z-10 mb-2 flex items-center justify-center gap-2" aria-label="Demo байршил хөдөлгөх">
            {([["left", "←"], ["up", "↑"], ["down", "↓"], ["right", "→"]] as const).map(([direction, arrow]) => (
              <button
                key={direction}
                type="button"
                onClick={() => moveDemoLocation(direction)}
                className="size-11 rounded-xl border border-[#67e8f9]/25 bg-[#101c22] text-xl text-[#d4e1e5] active:scale-95"
                aria-label={`Demo: ${direction}`}
              >
                {arrow}
              </button>
            ))}
            {safetyState && <span className="ml-1 text-[11px] font-semibold text-[#b7c7cc]">{safetyState.riskLevel}</span>}
          </div>
        )}

        {/* The companion stays on screen in every state and speaks its own messages. */}
        <section aria-label={`${companionName} AI туслах`} className="relative z-10 flex items-center gap-3">
          <CompanionMark
            state={companionState}
            avatar={settings.avatar}
            name={companionName}
            className="companion-avatar--compact companion-avatar--mini shrink-0"
          />
          <p
            aria-live="polite"
            aria-busy={assistantLoading}
            className="line-clamp-4 min-w-0 flex-1 rounded-2xl rounded-tl-md bg-[#10232b] px-4 py-3 text-[17px] font-semibold leading-6 text-[#f1f7f8] ring-1 ring-[#67e8f9]/15"
          >
            {companionMessage}
          </p>
          <button
            type="button"
            disabled={!safetyState || assistantLoading || speechStatus === "loading"}
            onClick={() => void speakMessage(assistantMessage)}
            aria-label={`${companionName}-г дахин сонсох`}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-[#0e7490] text-white shadow-[0_8px_20px_rgba(6,182,212,.25)] transition hover:bg-[#0c819d] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
          >
            {assistantLoading || speechStatus === "loading"
              ? <SafePathLoading variant="button" />
              : speechError
                ? <VolumeX size={22} aria-hidden="true" />
                : <Volume2 size={22} className={speechStatus === "playing" ? "animate-pulse" : ""} aria-hidden="true" />}
          </button>
        </section>

        {/* Calm map inside the Safe Zone; camera guidance takes over by itself once outside. */}
        <div className="relative z-10 mt-3 min-h-[360px] flex-1 overflow-hidden rounded-[28px] bg-[#101c22] ring-1 ring-[#67e8f9]/20 shadow-[0_18px_45px_rgba(0,0,0,.28)]">
          {guiding && currentLocation ? (
            <ArNavigationCamera
              location={currentLocation}
              route={route?.route ?? []}
              instruction={navigationInstruction ?? route?.nextInstruction ?? "Аюулгүй бүс рүү буцах зам тооцоолж байна…"}
              destinationName={targetZone?.name ?? "Аюулгүй бүс"}
              distanceMeters={route?.distanceMeters ?? null}
              autoStart
              voice={profile.voice}
              speechSpeed={settings.speechSpeed === "Удаан" ? "slow" : "normal"}
            />
          ) : currentLocation ? (
            <>
              <CompanionMap
                location={currentLocation}
                destination={targetZone ?? undefined}
                currentRoute={route?.route ?? []}
                variant="companion"
              />
              <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-10 block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#0e7490] shadow-[0_0_0_8px_rgba(14,116,144,.25)]" />
            </>
          ) : (
            <div role="status" className="absolute inset-x-5 bottom-5 rounded-2xl border border-[#67e8f9]/15 bg-[#071116]/85 px-4 py-3 text-sm leading-5 text-[#d4e1e5] backdrop-blur">
              {locationStatus === "loading" ? <SafePathLoading className="flex-col gap-1" label="Байршил тогтоож байна…" /> : locationError || "Байршлын зөвшөөрлөө шалгана уу."}
            </div>
          )}
        </div>

        <LocationSharingStatus />

        <section className="relative z-10 mt-2" aria-label="Яаралтай тусламж">
          {sosConfirm && !demoMode ? (
            <div className="rounded-2xl border border-rose-400/40 bg-[#140d12] p-3">
              <p className="text-center text-[16px] font-bold text-white">Асран хамгаалагчдаа SOS илгээх үү?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSosConfirm(false)} className="min-h-12 rounded-xl border border-white/15 px-3 text-[15px] font-semibold text-white">Болих</button>
                <button type="button" onClick={() => void sendSos()} disabled={sosStatus === "sending"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 text-[15px] font-bold text-white disabled:opacity-50">
                  {sosStatus === "sending" && <SafePathLoading variant="button" />}{sosStatus === "sending" ? "Илгээж байна…" : "Тийм, илгээх"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={demoMode || sosStatus === "sending"}
              onClick={() => {
                setSosConfirm(true);
                setSosStatus("idle");
                setSosMessage("");
              }}
              className="min-h-14 w-full rounded-2xl bg-rose-600 px-4 text-[17px] font-bold text-white shadow-[0_8px_24px_rgba(225,29,72,.22)] transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
            >
              🆘 SOS — Тусламж дуудах
            </button>
          )}
          {sosMessage && <p role={sosStatus === "error" ? "alert" : "status"} className={`mt-2 rounded-xl px-3 py-2 text-center text-sm leading-5 ${sosStatus === "error" ? "bg-rose-500/10 text-rose-200" : sosStatus === "sent" ? "bg-emerald-500/10 text-emerald-200" : "text-[#d4e1e5]"}`}>{sosMessage}</p>}
        </section>

        <audio
          ref={audioElement}
          className="sr-only"
          preload="none"
          onPlaying={() => setSpeechStatus("playing")}
          onEnded={() => setSpeechStatus("idle")}
          onError={() => {
            setSpeechStatus("error");
            setSpeechError("Дуу тоглуулах боломжгүй байна.");
          }}
        />
      </main>
    </AppShell>
  );
}

function isSafeZoneList(value: unknown): value is SafeZone[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const zone = item as Record<string, unknown>;
    return (
      typeof zone.id === "string" &&
      typeof zone.name === "string" &&
      typeof zone.latitude === "number" && Number.isFinite(zone.latitude) &&
      typeof zone.longitude === "number" && Number.isFinite(zone.longitude) &&
      typeof zone.radiusMeters === "number" && Number.isFinite(zone.radiusMeters) &&
      zone.radiusMeters >= 50 && zone.radiusMeters <= 2000
    );
  });
}

function getGuidanceFallback(zoneName: string) {
  return `${zoneName} руу хамт буцъя. Цэнхэр сумыг дагаад алхаарай.`;
}
