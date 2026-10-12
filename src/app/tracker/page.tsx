"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Map as MapIcon, MapPin } from "lucide-react";
import { LocationSharingStatus } from "@/components/location-sharing-status";
import ArNavigationCamera from "@/components/ar-navigation-camera";
import { AppShell, CompanionMark } from "@/components/safe-path";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { useGeolocation } from "@/hooks/use-geolocation";
import { toCompanionProfile } from "@/lib/assistant-settings";
import { getSafetyFallback } from "@/lib/ai/fallback-messages";
import { calculateSafetyState } from "@/lib/risk-engine";
import { getSafeZoneProximities } from "@/lib/geofence";
import { SAFE_ZONES } from "@/lib/safe-zones";
import type { SafeZone, SafetyAssistantRequest, SafetyState } from "@/types/safety";

const CompanionMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => <p className="absolute inset-x-4 bottom-5 rounded-xl bg-[#071116]/85 px-3 py-2 text-xs text-[#d4e1e5]">Газрын зураг ачаалж байна…</p>,
});


type SpeechStatus = "idle" | "loading" | "playing" | "error";

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

  const { settings } = useAssistantSettings();

  

  const [demoMode, setDemoMode] = useState(false);
  const [navigationView, setNavigationView] = useState<"map" | "camera">("map");
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

        const fallbackMessage =
          getSafetyFallback(
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


  return (
    <AppShell>
      <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-linear-to-b from-[#071116] via-[#0b151b] to-[#050a0e] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-[12%] size-64 rounded-full bg-[#06b6d4]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-[#0e7490]/20 blur-3xl" />
        <div className="relative z-10 flex justify-center pb-3">
          <button
            type="button"
            onClick={() =>
              setDemoMode(
                (value) => !value,
              )
            }
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              demoMode
                ? "border-[#67e8f9] bg-[#0e7490] text-white"
                : "border-[#67e8f9]/25 bg-[#101c22] text-[#d4e1e5]"
            }`}
          >
            {demoMode
              ? "🟢 Demo Mode ON"
              : "Demo Mode OFF"}
          </button>
        </div>

    

        {demoMode && (
          <div className="relative z-10 mb-4 flex flex-col items-center gap-2">

            <button
              type="button"
              onClick={() =>
                moveDemoLocation(
                  "up",
                )
              }
              className="h-12 w-12 rounded-xl border border-[#67e8f9]/25 bg-[#101c22] text-[#d4e1e5] text-xl active:scale-95"
              aria-label="Demo move up"
            >
              ↑
            </button>

            <div className="flex gap-2">

              <button
                type="button"
                onClick={() =>
                  moveDemoLocation(
                    "left",
                  )
                }
                className="h-12 w-12 rounded-xl border border-[#67e8f9]/25 bg-[#101c22] text-[#d4e1e5] text-xl active:scale-95"
                aria-label="Demo move left"
              >
                ←
              </button>

              <button
                type="button"
                onClick={() =>
                  moveDemoLocation(
                    "down",
                  )
                }
                className="h-12 w-12 rounded-xl border border-[#67e8f9]/25 bg-[#101c22] text-[#d4e1e5] text-xl active:scale-95"
                aria-label="Demo move down"
              >
                ↓
              </button>

              <button
                type="button"
                onClick={() =>
                  moveDemoLocation(
                    "right",
                  )
                }
                className="h-12 w-12 rounded-xl border border-[#67e8f9]/25 bg-[#101c22] text-[#d4e1e5] text-xl active:scale-95"
                aria-label="Demo move right"
              >
                →
              </button>

            </div>

            <p className="text-xs text-[#b7c7cc]">
              1 алхам ≈ 110м ·{" "}
              {demoLocation.latitude.toFixed(
                6,
              )}
              ,{" "}
              {demoLocation.longitude.toFixed(
                6,
              )}
            </p>

            {safetyState && (
              <div className="rounded-full border border-[#67e8f9]/20 bg-[#0d2028] px-4 py-2 text-xs font-medium text-[#d4e1e5]">
                Status:{" "}
                {safetyState.riskLevel}
              </div>
            )}
          </div>
        )}

        <header className="relative z-10 flex min-h-16 items-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-[17px] font-bold tracking-[-0.02em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
          ><span className="grid size-8 place-items-center rounded-xl bg-[#0e7490] text-[#cffafe]"><MapPin size={17} fill="currentColor" /></span>SafePath
          </Link>
        </header>


        <section
          className="relative z-10 flex flex-1 flex-col items-center pb-5 text-center"
          aria-label="Милотой ярилцах"
        >
          <div className="mt-3 grid w-full grid-cols-2 gap-2" aria-label="Навигацийн харагдац">
            <button
              type="button"
              onClick={() => setNavigationView("map")}
              aria-pressed={navigationView === "map"}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${navigationView === "map" ? "border-[#67e8f9]/70 bg-[#0e7490] text-white" : "border-[#67e8f9]/20 bg-[#101c22] text-[#b7c7cc]"}`}
            >
              <MapIcon size={17} /> Газрын зураг
            </button>
            <button
              type="button"
              onClick={() => setNavigationView("camera")}
              aria-pressed={navigationView === "camera"}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${navigationView === "camera" ? "border-[#67e8f9]/70 bg-[#0e7490] text-white" : "border-[#67e8f9]/20 bg-[#101c22] text-[#b7c7cc]"}`}
            >
              <Camera size={17} /> Камераар чиглүүлэх
            </button>
          </div>

          <div className="relative mt-2 flex h-[clamp(360px,57dvh,560px)] w-full shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-[#67e8f9]/25 bg-[#101c22] shadow-[0_18px_45px_rgba(0,0,0,.28)]">
            {navigationView === "camera" && currentLocation ? (
              <ArNavigationCamera
                location={currentLocation}
                route={route?.route ?? []}
                instruction={navigationInstruction ?? route?.nextInstruction ?? "Аюулгүй бүс рүү буцах зам тооцоолж байна…"}
                destinationName={targetZone?.name ?? "Аюулгүй бүс"}
                distanceMeters={route?.distanceMeters ?? null}
              />
            ) : currentLocation ? (
              <>
                <CompanionMap
                  location={currentLocation}
                  destination={targetZone ?? undefined}
                  currentRoute={route?.route ?? []}
                  variant="companion"
                />
                <CompanionMark
                  state={
                    safetyState?.riskLevel === "HIGH_RISK" || safetyState?.riskLevel === "WARNING"
                      ? "warning"
                      : speechStatus === "playing"
                        ? "speaking"
                        : "idle"
                  }
                  avatar={settings.avatar}
                  name={settings.name || "Мило"}
                  className="companion-avatar--compact relative z-10"
                />
              </>
            ) : (
              <p role="status" className="absolute inset-x-5 bottom-5 rounded-2xl border border-[#67e8f9]/15 bg-[#071116]/85 px-4 py-3 text-xs leading-5 text-[#d4e1e5] backdrop-blur">
                {locationStatus === "loading" ? "Байршил тогтоож байна…" : locationError || "Байршлын зөвшөөрлөө шалгана уу."}
              </p>
            )}
          </div>
          {!demoMode && !zonesLoaded && (
            <p role="status" className="mt-3 text-sm text-[#b7c7cc]">
              Аюулгүй бүсүүдийг ачаалж байна…
            </p>
          )}
          {!demoMode && zonesLoadError && (
            <p role="alert" className="mt-3 text-sm text-[#fda4af]">
              {zonesLoadError}
            </p>
          )}
          {!demoMode && zonesLoaded && !zonesLoadError && savedZones.length === 0 && (
            <p role="status" className="mt-3 max-w-[320px] text-sm leading-6 text-[#fbbf24]">
              Танд аюулгүй бүс тохируулаагүй байна. Асран хамгаалагчаасаа бүс нэмүүлээрэй.
            </p>
          )}
          {routeStatus === "loading" && targetZone && (
            <p role="status" className="mt-3 text-sm text-[#b7c7cc]">
              {targetZone.name} руу буцах замыг тооцоолж байна…
            </p>
          )}
          {routeStatus === "error" && targetZone && (
            <p role="status" className="mt-3 text-sm text-[#fda4af]">
              Буцах замыг тооцоолж чадсангүй. Байршлаа шалгаад дахин оролдоно уу.
            </p>
          )}
          <p className="text-[16px] font-semibold text-[#67e8f9]">{settings.name || "Мило"}</p>
          <p aria-live="polite" aria-busy={assistantLoading} className="mx-auto mt-3 max-w-[320px] text-[17px] leading-7 tracking-[-0.01em] text-[#f1f7f8]">
            {assistantMessage || (safetyState ? getSafetyFallback(safetyState.riskLevel, profile.userName) : zonesLoadError || (zonesLoaded && !demoMode && savedZones.length === 0 ? "Асран хамгаалагчаасаа аюулгүй бүс тохируулж өгөхийг хүсээрэй." : "Байршил болон аюулгүй бүс ачаалж байна…"))}
          </p>
          {assistantLoading && <span className="mt-3 text-sm text-[#b7c7cc]">Мило бодож байна…</span>}
          {speechStatus === "loading" && <span className="mt-2 text-sm text-[#b7c7cc]">Дуу бэлдэж байна…</span>}
          {speechStatus === "playing" && <span className="mt-2 text-sm text-[#67e8f9]">Мило ярьж байна…</span>}
          {speechError && <span role="status" className="mt-2 text-sm text-[#fda4af]">{speechError}</span>}

          {navigationInstruction && (
            <div className="mt-7 flex w-full items-center gap-4 rounded-2xl border border-[#67e8f9]/20 bg-[#0d2028]/90 px-5 py-4 text-left text-white shadow-[0_12px_28px_rgba(0,0,0,.18)]">
              <span className="text-3xl text-[#67e8f9]" aria-hidden="true">➜</span>
              <div className="min-w-0">
                <p className="font-semibold">{navigationInstruction}</p>
                {route?.distanceMeters != null && <p className="mt-1 text-sm text-[#b7c7cc]">{targetZone?.name ?? "Аюулгүй бүс"} хүртэл ойролцоогоор {formatDistance(route.distanceMeters)}</p>}
              </div>
            </div>
          )}
        </section>

        <LocationSharingStatus />

        <section className="mt-3 rounded-2xl border border-rose-500/35 bg-rose-500/5 p-4" aria-label="Яаралтай тусламж">
          <p className="text-sm leading-6 text-[#f4c7c7]">Аюултай санагдвал холбогдсон асран хамгаалагчдаа SOS дохио илгээнэ.</p>
          <button
            type="button"
            disabled={demoMode || sosStatus === "sending"}
            onClick={() => {
              setSosConfirm(true);
              setSosStatus("idle");
              setSosMessage("");
            }}
            className="mt-3 min-h-14 w-full rounded-2xl border border-rose-400/60 bg-rose-600 px-4 text-base font-bold text-white shadow-[0_8px_24px_rgba(225,29,72,.18)] transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
          >
            🆘 Яаралтай тусламж — SOS
          </button>
          {demoMode && <p className="mt-2 text-xs leading-5 text-[#b7c7cc]">Demo Mode үед бодит SOS илгээхгүй.</p>}
          {sosConfirm && !demoMode && (
            <div className="mt-3 rounded-xl border border-rose-400/35 bg-[#140d12] p-3">
              <p className="text-sm font-semibold text-white">Асран хамгаалагчдаа SOS дохио илгээх үү?</p>
              <p className="mt-1 text-xs leading-5 text-[#d9b4b9]">Тэд SafePath-ийн мэдэгдэл дээр яаралтай тусламж хүссэнийг харна. Хэрэв шууд аюул тулгарвал яаралтай тусламж руу залгаарай.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSosConfirm(false)} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm font-medium text-white">Болих</button>
                <button type="button" onClick={() => void sendSos()} disabled={sosStatus === "sending"} className="min-h-11 rounded-xl bg-rose-600 px-3 text-sm font-bold text-white disabled:opacity-50">{sosStatus === "sending" ? "Илгээж байна…" : "Тийм, илгээх"}</button>
              </div>
            </div>
          )}
          {sosMessage && <p role={sosStatus === "error" ? "alert" : "status"} className={`mt-3 rounded-xl px-3 py-2 text-sm leading-5 ${sosStatus === "error" ? "bg-rose-500/10 text-rose-200" : sosStatus === "sent" ? "bg-emerald-500/10 text-emerald-200" : "text-[#d4e1e5]"}`}>{sosMessage}</p>}
        </section>

        <div className="pt-2">
          <button
            type="button"
            disabled={
              !safetyState ||
              assistantLoading ||
              speechStatus ===
                "loading"
            }
            onClick={() =>
              void speakMessage(
                assistantMessage,
              )
            }
            aria-label="Милогийн зөвлөгөөг сонсох"
            className="w-full min-h-14 rounded-2xl bg-[#0e7490] px-4 text-[15px] font-bold text-white shadow-[0_10px_28px_rgba(6,182,212,.24)] transition-colors hover:bg-[#0c819d] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
          >
            {assistantLoading
              ? "Мило бодож байна…"
              : speechStatus ===
                  "loading"
                ? "Дуу бэлдэж байна…"
                : speechStatus ===
                    "playing"
                  ? "Ярьж байна…"
                  : "Ярих"}
          </button>
        </div>

        <nav aria-label="Тусламж болон холбох код" className="relative z-10 mt-2 flex items-center justify-center gap-2">
          <a href="tel:+97600000000" className="inline-flex min-h-11 items-center px-3 text-[14px] font-medium text-[#b7c7cc] underline decoration-[#49636c] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]">Тусламж хэрэгтэй</a>
          <Link href="/tracker/code" className="inline-flex min-h-11 items-center px-3 text-[14px] font-medium text-[#67e8f9] underline decoration-[#1d7080] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]">Холбох код</Link>
        </nav>
        <audio
          ref={audioElement}
          className="sr-only"
          preload="none"
          onPlaying={() =>
            setSpeechStatus(
              "playing",
            )
          }
          onEnded={() =>
            setSpeechStatus("idle")
          }
          onError={() => {
            setSpeechStatus(
              "error",
            );
            setSpeechError(
              "Дуу тоглуулах боломжгүй байна.",
            );
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

function formatDistance(
  meters: number,
) {
  if (meters < 1000) {
    return `${Math.max(
      10,
      Math.round(meters),
    )} м`;
  }

  return `${(
    meters / 1000
  ).toFixed(1)} км`;
}
