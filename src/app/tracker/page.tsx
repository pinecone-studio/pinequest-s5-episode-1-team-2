"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { LocationSharingStatus } from "@/components/location-sharing-status";
import { AppShell, CompanionMark } from "@/components/safe-path";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { useGeolocation } from "@/hooks/use-geolocation";
import { toCompanionProfile } from "@/lib/assistant-settings";
import { getSafetyFallback } from "@/lib/ai/fallback-messages";
import { calculateSafetyState } from "@/lib/risk-engine";
import { SAFE_ZONES } from "@/lib/safe-zones";
import type { SafetyAssistantRequest, SafetyState } from "@/types/safety";

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

  const [demoLocation, setDemoLocation] = useState({
    latitude: SAFE_ZONES[0].latitude,
    longitude: SAFE_ZONES[0].longitude,
    accuracy: 5,
    lastUpdated: Date.now(),
  });



  const [assistantMessage, setAssistantMessage] = useState(
    "Байршил тогтоож байна…",
  );

  const [assistantLoading, setAssistantLoading] = useState(false);

  const [speechStatus, setSpeechStatus] =
    useState<SpeechStatus>("idle");

  const [speechError, setSpeechError] = useState("");

  const [route, setRoute] =
    useState<RouteResult | null>(null);

  const [routeStatus, setRouteStatus] =
    useState<"loading" | "ready" | "error">("loading");


  const routeController =
    useRef<AbortController | null>(null);

  const lastRouteAt =
    useRef(0);

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

  const navigationInstruction =
    route?.nextInstruction;


 
  const currentLocation =
    demoMode
      ? demoLocation
      : location;


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
      currentLocation
        ? calculateSafetyState({
            location: currentLocation,
            routeDeviation,
          })
        : null,
    [currentLocation, routeDeviation],
  );


  useEffect(() => {
    if (!currentLocation) {
      setRoute(null);
      setRouteStatus("loading");
      return;
    }

    const now = Date.now();

    if (
      !demoMode &&
      lastRouteAt.current !== 0 &&
      now - lastRouteAt.current < 10_000
    ) {
      return;
    }

    lastRouteAt.current = now;
    routeController.current?.abort();

    const controller = new AbortController();
    routeController.current = controller;
    setRouteStatus("loading");

    const origin = {
      lat: currentLocation.latitude,
      lon: currentLocation.longitude,
    };

    const destination = {
      lat: SAFE_ZONES[0].latitude,
      lon: SAFE_ZONES[0].longitude,
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
  }, [
    currentLocation?.latitude,
    currentLocation?.longitude,
    demoMode,
  ]);

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
            SAFE_ZONES[0].name,

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
      ],
    );

  const automaticRequestKey =
    safetyState
      ? [
          safetyState.riskLevel,
          safetyState.routeDeviation,
          navigationInstruction ?? "",
          demoMode
            ? `${demoLocation.latitude}:${demoLocation.longitude}`
            : "",
        ].join(":")
      : null;

  useEffect(() => {
    if (
      !safetyState ||
      !automaticRequestKey ||
      lastAutomaticRequest.current ===
        automaticRequestKey
    ) {
      return;
    }

    lastAutomaticRequest.current =
      automaticRequestKey;

    void requestAssistantMessage(
      safetyState,
    );
  }, [
    automaticRequestKey,
    requestAssistantMessage,
    safetyState,
  ]);


  useEffect(() => {
    return () => {
      requestController.current?.abort();

      speechController.current?.abort();

      audioElement.current?.pause();

      speechCache.current.forEach(
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



          <div className="relative mt-2 flex h-[clamp(300px,47dvh,440px)] w-full shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-[#67e8f9]/25 bg-[#101c22] shadow-[0_18px_45px_rgba(0,0,0,.28)]">

            {currentLocation ? (
              <CompanionMap
                location={
                  currentLocation
                }
                destination={
                  SAFE_ZONES[0]
                }
                currentRoute={
                  route?.route ?? []
                }
                variant="companion"
              />
            ) : (
              <p role="status" className="absolute inset-x-5 bottom-5 rounded-2xl border border-[#67e8f9]/15 bg-[#071116]/85 px-4 py-3 text-xs leading-5 text-[#d4e1e5] backdrop-blur">
                {locationStatus === "loading" ? "Байршил тогтоож байна…" : locationError || "Байршлын зөвшөөрлөө шалгана уу."}
              </p>
            )}

            <CompanionMark
              state={
                safetyState?.riskLevel ===
                  "HIGH_RISK" ||
                safetyState?.riskLevel ===
                  "WARNING"
                  ? "warning"
                  : speechStatus ===
                      "playing"
                    ? "speaking"
                    : "idle"
              }
              avatar={
                settings.avatar
              }
              name={
                settings.name ||
                "Мило"
              }
              className="companion-avatar--compact relative z-10"
            />
          </div>
          {routeStatus === "loading" && (
            <p role="status" className="mt-3 text-sm text-[#b7c7cc]">
              Буцах замыг тооцоолж байна…
            </p>
          )}
          {routeStatus === "error" && (
            <p role="status" className="mt-3 text-sm text-[#fda4af]">
              Буцах замыг тооцоолж чадсангүй.
            </p>
          )}
          <p className="text-[16px] font-semibold text-[#67e8f9]">{settings.name || "Мило"}</p>
          <p aria-live="polite" aria-busy={assistantLoading} className="mx-auto mt-3 max-w-[320px] text-[17px] leading-7 tracking-[-0.01em] text-[#f1f7f8]">
            {assistantMessage || (safetyState ? getSafetyFallback(safetyState.riskLevel, profile.userName) : "Байршил тогтоож байна…")}
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
                {route?.distanceMeters != null && <p className="mt-1 text-sm text-[#b7c7cc]">Гэр хүртэл ойролцоогоор {formatDistance(route.distanceMeters)}</p>}
              </div>
            </div>
          )}
        </section>

        <LocationSharingStatus />

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

        <a href="tel:+97600000000" className="mx-auto mt-2 inline-flex min-h-11 items-center px-4 text-[14px] font-medium text-[#b7c7cc] underline decoration-[#49636c] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]">Тусламж хэрэгтэй</a>
        <Link href="/tracker/code" className="mx-auto inline-flex min-h-11 items-center px-4 text-[14px] font-medium text-[#67e8f9] underline decoration-[#1d7080] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]">Холбох код</Link>
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
