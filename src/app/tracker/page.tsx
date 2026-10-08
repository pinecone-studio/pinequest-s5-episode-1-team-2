"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  loading: () => (
    <p className="absolute inset-x-4 bottom-5 text-xs text-[#737373]">
      Газрын зураг ачаалж байна…
    </p>
  ),
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

  /* =========================================================
     DEMO MODE
     ========================================================= */

  const [demoMode, setDemoMode] = useState(false);

  const [demoLocation, setDemoLocation] = useState({
    latitude: SAFE_ZONES[0].latitude,
    longitude: SAFE_ZONES[0].longitude,
    accuracy: 5,
    timestamp: Date.now(),
  });

  /* =========================================================
     NORMAL STATE
     ========================================================= */

  const [assistantMessage, setAssistantMessage] = useState(
    "Байршил тогтоож байна…",
  );

  const [assistantLoading, setAssistantLoading] = useState(false);

  const [speechStatus, setSpeechStatus] =
    useState<SpeechStatus>("idle");

  const [speechError, setSpeechError] = useState("");

  const [route, setRoute] =
    useState<RouteResult | null>(null);

  /* =========================================================
     REFS
     ========================================================= */

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

  /* =========================================================
     PROFILE
     ========================================================= */

  const profile = useMemo(
    () => toCompanionProfile(settings),
    [settings],
  );

  const navigationInstruction =
    route?.nextInstruction;

  /*
   * IMPORTANT:
   *
   * Demo Mode ON  -> use demoLocation
   * Demo Mode OFF -> use real GPS
   */
  const currentLocation =
    demoMode
      ? demoLocation
      : location;

  /* =========================================================
     DEMO LOCATION MOVEMENT
     ========================================================= */

  const moveDemoLocation = useCallback(
    (
      direction:
        | "up"
        | "down"
        | "left"
        | "right",
    ) => {
      setDemoLocation((current) => {
        /*
         * 0.001 latitude/longitude is roughly 110 meters.
         *
         * Therefore:
         *
         * ↑ = ~110m
         * ↓ = ~110m
         * ← = ~110m
         * → = ~110m
         */

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
          timestamp: Date.now(),
        };
      });
    },
    [],
  );

  /* =========================================================
     SAFETY STATE
     ========================================================= */

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

  /* =========================================================
     ROUTE REQUEST
     ========================================================= */

  useEffect(() => {
    if (!currentLocation) {
      return;
    }

    const now = Date.now();

    /*
     * REAL GPS:
     * wait 15 seconds between route requests.
     *
     * DEMO MODE:
     * do NOT wait.
     *
     * This means every arrow press immediately
     * recalculates the route.
     */

    if (
      !demoMode &&
      lastRouteAt.current !== 0 &&
      now - lastRouteAt.current < 15_000
    ) {
      return;
    }

    lastRouteAt.current = now;

    routeController.current?.abort();

    const controller =
      new AbortController();

    routeController.current =
      controller;

    void fetch("/api/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin: {
          lat: currentLocation.latitude,
          lon: currentLocation.longitude,
        },

        destination: {
          lat: SAFE_ZONES[0].latitude,
          lon: SAFE_ZONES[0].longitude,
        },
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            "Route request failed.",
          );
        }

        const result =
          (await response.json()) as RouteResult;

        if (
          !Array.isArray(result.route) ||
          result.route.length < 2 ||
          typeof result.nextInstruction !==
            "string"
        ) {
          throw new Error(
            "Invalid route response.",
          );
        }

        setRoute(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRoute((current) => current);
        }
      });
  }, [
    currentLocation?.latitude,
    currentLocation?.longitude,
    demoMode,
  ]);

  /* =========================================================
     CLEANUP ROUTE
     ========================================================= */

  useEffect(() => {
    return () => {
      routeController.current?.abort();
    };
  }, []);

  /* =========================================================
     TEXT TO SPEECH
     ========================================================= */

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

  /* =========================================================
     AI ASSISTANT
     ========================================================= */

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

  /* =========================================================
     AUTOMATIC AI TRIGGER
     ========================================================= */

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

  /* =========================================================
     CLEANUP
     ========================================================= */

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

  /* =========================================================
     UI
     ========================================================= */

  return (
    <AppShell>
      <main className="flex min-h-dvh flex-col px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">

        {/* =================================================
            DEMO MODE BUTTON
            ================================================= */}

        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={() =>
              setDemoMode(
                (value) => !value,
              )
            }
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              demoMode
                ? "border-[#111111] bg-[#111111] text-white"
                : "border-[#d8d8d4]"
            }`}
          >
            {demoMode
              ? "🟢 Demo Mode ON"
              : "Demo Mode OFF"}
          </button>
        </div>

        {/* =================================================
            DEMO CONTROLS
            ================================================= */}

        {demoMode && (
          <div className="mb-4 flex flex-col items-center gap-2">

            <button
              type="button"
              onClick={() =>
                moveDemoLocation(
                  "up",
                )
              }
              className="h-12 w-12 rounded-xl border border-[#d8d8d4] text-xl active:scale-95"
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
                className="h-12 w-12 rounded-xl border border-[#d8d8d4] text-xl active:scale-95"
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
                className="h-12 w-12 rounded-xl border border-[#d8d8d4] text-xl active:scale-95"
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
                className="h-12 w-12 rounded-xl border border-[#d8d8d4] text-xl active:scale-95"
                aria-label="Demo move right"
              >
                →
              </button>

            </div>

            <p className="text-xs text-[#737373]">
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
              <div className="rounded-full bg-[#f1f1ee] px-4 py-2 text-xs font-medium">
                Status:{" "}
                {safetyState.riskLevel}
              </div>
            )}
          </div>
        )}

        {/* =================================================
            HEADER
            ================================================= */}

        <header className="flex min-h-16 items-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-[17px] font-semibold tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
          >
            SafePath
          </Link>
        </header>

        {/* =================================================
            MAIN
            ================================================= */}

        <section
          className="flex flex-1 flex-col items-center pb-5 text-center"
          aria-label="Милотой ярилцах"
        >

          {/* MAP */}

          <div className="relative mt-2 flex h-[clamp(300px,47dvh,440px)] w-full shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-[#e7e7e5] bg-[#f2f2ef]">

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
              <p
                role="status"
                className="absolute inset-x-5 bottom-5 text-xs leading-5 text-[#737373]"
              >
                {locationStatus ===
                "loading"
                  ? "Байршил тогтоож байна…"
                  : locationError ||
                    "Байршлын зөвшөөрлөө шалгана уу."}
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

          {/* COMPANION NAME */}

          <p className="text-[16px] font-medium text-[#737373]">
            {settings.name ||
              "Мило"}
          </p>

          {/* AI MESSAGE */}

          <p
            aria-live="polite"
            aria-busy={
              assistantLoading
            }
            className="mx-auto mt-3 max-w-[320px] text-[17px] leading-7 tracking-[-0.01em] text-[#292a27]"
          >
            {assistantMessage ||
              (safetyState
                ? getSafetyFallback(
                    safetyState.riskLevel,
                    profile.userName,
                  )
                : "Байршил тогтоож байна…")}
          </p>

          {/* AI STATUS */}

          {assistantLoading && (
            <span className="mt-3 text-sm text-[#737373]">
              Мило бодож байна…
            </span>
          )}

          {speechStatus ===
            "loading" && (
            <span className="mt-2 text-sm text-[#737373]">
              Дуу бэлдэж байна…
            </span>
          )}

          {speechStatus ===
            "playing" && (
            <span className="mt-2 text-sm text-[#737373]">
              Мило ярьж байна…
            </span>
          )}

          {speechError && (
            <span
              role="status"
              className="mt-2 text-sm text-[#737373]"
            >
              {speechError}
            </span>
          )}

          {/* NAVIGATION */}

          {navigationInstruction && (
            <div className="mt-7 flex w-full items-center gap-4 rounded-2xl bg-[#f1f1ee] px-5 py-4 text-left">

              <span
                className="text-3xl"
                aria-hidden="true"
              >
                ➜
              </span>

              <div className="min-w-0">

                <p className="font-semibold">
                  {
                    navigationInstruction
                  }
                </p>

                {route?.distanceMeters !=
                  null && (
                  <p className="mt-1 text-sm text-[#737373]">
                    Гэр хүртэл ойролцоогоор{" "}
                    {formatDistance(
                      route.distanceMeters,
                    )}
                  </p>
                )}

              </div>
            </div>
          )}
        </section>

        {/* =================================================
            SPEAK BUTTON
            ================================================= */}

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
            className="w-full min-h-[54px] rounded-2xl bg-[#111111] px-4 text-[15px] font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
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

        {/* =================================================
            HELP
            ================================================= */}

        <a
          href="tel:+97600000000"
          className="mx-auto mt-2 inline-flex min-h-11 items-center px-4 text-[14px] font-medium text-[#737373] underline decoration-[#c8c8c4] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
        >
          Тусламж хэрэгтэй
        </a>

        {/* =================================================
            CONNECTION CODE
            ================================================= */}

        <Link
          href="/tracker/code"
          className="mx-auto inline-flex min-h-11 items-center px-4 text-[14px] font-medium text-[#737373] underline decoration-[#c8c8c4] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
        >
          Холбох код
        </Link>

        {/* =================================================
            AUDIO
            ================================================= */}

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

/* =========================================================
   DISTANCE FORMAT
   ========================================================= */

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