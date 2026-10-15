"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  ChevronLeft,
  Gamepad2,
  Settings,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import {ChevronLeft, Settings, Volume2, VolumeX, WifiOff} from "lucide-react";
import {LocationSharingStatus} from "@/components/location-sharing-status";
import ArNavigationCamera from "@/components/ar-navigation-camera";
import {HeadingArrow, TiltedPlane} from "@/components/tilted-plane";
import {AppShell, CompanionMark} from "@/components/safe-path";
import {CheckpointGoal, RewardCelebration} from "@/components/checkpoint-goal";
import {useCheckpoints} from "@/hooks/use-checkpoints";
import {describeReward, effectiveAvatar, isAccessoryId} from "@/types/rewards";
import {SafePathLoading} from "@/components/safepath-loading";
import {useAssistantSettings} from "@/hooks/use-assistant-settings";
import {useCompassHeading} from "@/hooks/use-compass-heading";
import {useGeolocation} from "@/hooks/use-geolocation";
import {useNetworkStatus} from "@/hooks/use-network-status";
import {toCompanionProfile} from "@/lib/assistant-settings";
import {getGameFallback, getSafetyFallback} from "@/lib/ai/fallback-messages";
import {calculateSafetyState} from "@/lib/risk-engine";
import {getSafeZoneProximities} from "@/lib/geofence";
import {SAFE_ZONES} from "@/lib/safe-zones";
import type {
  SafeZone,
  SafetyAssistantRequest,
  SafetyState,
} from "@/types/safety";

const CompanionMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => (
    <SafePathLoading
      className="absolute inset-x-4 bottom-5 rounded-xl bg-[#071116]/85"
      label="Газрын зураг ачаалж байна…"
    />
  ),
});

type SpeechStatus = "idle" | "loading" | "playing" | "error";

// Guidance starts by itself once the person has clearly left the Safe Zone, and ends once they
// are clearly back. The short waits stop GPS jitter at the boundary from flicking the camera.
const GUIDANCE_START_DELAY_MS = 5_000;
const GUIDANCE_STOP_DELAY_MS = 15_000;
// Where the person sits on the slanted calm map, as a share of its height.
const CALM_MAP_CENTER_PERCENT = 64;

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

  const {settings, update} = useAssistantSettings();

  const [demoMode, setDemoMode] = useState(false);
  const [guiding, setGuiding] = useState(false);
  // The calm map turns with the compass; while guiding, the camera view reads its own.
  const {heading: calmHeading} = useCompassHeading(!guiding);
  const [savedZones, setSavedZones] = useState<SafeZone[]>([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [zonesLoadError, setZonesLoadError] = useState("");
  const [sosConfirm, setSosConfirm] = useState(false);
  const [sosStatus, setSosStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
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
          setZonesLoadError(
            "Аюулгүй бүсүүдийг ачаалж чадсангүй. Интернэтээ шалгана уу."
          );
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

  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("idle");

  const [speechError, setSpeechError] = useState("");

  const [route, setRoute] = useState<RouteResult | null>(null);

  const [routeStatus, setRouteStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const routeController = useRef<AbortController | null>(null);

  const lastRouteAt = useRef(0);

  const lastRouteTargetId = useRef<string | null>(null);

  const lastAutomaticRequest = useRef<string | null>(null);

  const requestSequence = useRef(0);

  const requestController = useRef<AbortController | null>(null);

  const speechSequence = useRef(0);

  const speechController = useRef<AbortController | null>(null);

  const speechCache = useRef(new Map<string, string>());

  const audioElement = useRef<HTMLAudioElement | null>(null);

  const profile = useMemo(() => toCompanionProfile(settings), [settings]);

  const currentLocation = demoMode ? demoLocation : location;
  const {checkpoints, rewards} = useCheckpoints();
  const goal = checkpoints.find((checkpoint) => !checkpoint.reachedAt) ?? null;
  // Reward companions and accessories only show once earned.
  const shownAvatar = effectiveAvatar(settings.avatar, rewards);
  const shownAccessory =
    settings.accessory && rewards?.includes(settings.accessory)
      ? settings.accessory
      : null;
  const [celebrated, setCelebrated] = useState<string[]>(readCelebrated);
  const celebrating =
    checkpoints.find(
      (checkpoint) => checkpoint.reachedAt && !celebrated.includes(checkpoint.id)
    ) ?? null;
  const finishCelebration = (id: string) => {
    const next = [...celebrated, id].slice(-50);
    setCelebrated(next);
    try {
      window.localStorage.setItem(CELEBRATED_KEY, JSON.stringify(next));
    } catch {
      // Without storage the celebration may show again next visit; that is harmless.
    }
  };
  const currentLatitude = currentLocation?.latitude;
  const currentLongitude = currentLocation?.longitude;
  // Demo uses the guardian's own saved zones (e.g. "Гэр"); the sample list is only a fallback
  // for when nothing has been saved yet.
  const demoZones = savedZones.length > 0 ? savedZones : SAFE_ZONES;
  const activeZones = demoMode ? demoZones : savedZones;
  const targetZone = useMemo(() => {
    if (!currentLocation || activeZones.length === 0) return null;
    return (
      getSafeZoneProximities(currentLocation, activeZones)[0]?.zone ?? null
    );
  }, [activeZones, currentLocation]);

  const sendSos = useCallback(async () => {
    if (demoMode || sosStatus === "sending") return;
    setSosStatus("sending");
    setSosMessage("SOS дохио илгээж байна…");
    try {
      const response = await fetch("/api/sos", {
        method: "POST",
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      const message =
        payload &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof payload.message === "string"
          ? payload.message
          : payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof payload.error === "string"
          ? payload.error
          : "SOS хүсэлтийн хариуг уншиж чадсангүй.";
      if (!response.ok) throw new Error(message);
      setSosStatus("sent");
      setSosMessage(message);
      setSosConfirm(false);
    } catch (error) {
      setSosStatus("error");
      setSosMessage(
        error instanceof Error ? error.message : "SOS дохио илгээж чадсангүй."
      );
    }
  }, [demoMode, sosStatus]);

  const moveDemoLocation = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
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
    []
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
    [activeZones, currentLocation, routeDeviation]
  );

  const navigationInstruction =
    safetyState && !safetyState.isInsideSafeZone && targetZone
      ? route?.nextInstruction
      : undefined;

  // Outside a configured Safe Zone, the screen turns into camera guidance with the companion on
  // top; back inside, it returns to the calm map. Both switches wait a moment to ride out GPS jitter.
  const isOutsideSafeZone = Boolean(
    safetyState && targetZone && !safetyState.isInsideSafeZone
  );
  useEffect(() => {
    if (isOutsideSafeZone === guiding) return;
    const timer = window.setTimeout(
      () => setGuiding(isOutsideSafeZone),
      isOutsideSafeZone ? GUIDANCE_START_DELAY_MS : GUIDANCE_STOP_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [guiding, isOutsideSafeZone]);

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
            Number.isFinite(point[1])
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
            Number.isFinite(point[1])
        )
        .map(
          (point: [number, number]) => [point[1], point[0]] as [number, number]
        );

      if (points.length < 2) {
        throw new Error("Fallback route geometry is invalid");
      }

      const step = osrmRoute.legs?.[0]?.steps?.[0];
      const maneuver = step?.maneuver;
      const modifier =
        typeof maneuver?.modifier === "string" ? maneuver.modifier : "";

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
          typeof osrmRoute.distance === "number" ? osrmRoute.distance : null,
        durationSeconds:
          typeof osrmRoute.duration === "number" ? osrmRoute.duration : null,
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
    currentLatitude,
    currentLongitude,
    demoMode,
    safetyState?.isInsideSafeZone,
    targetZone?.id,
    targetZone?.latitude,
    targetZone?.longitude,
  ]);

  useEffect(() => {
    return () => {
      routeController.current?.abort();
    };
  }, []);

  // When the companion last started talking, so an automatic game never cuts into guidance.
  const lastSpeechAt = useRef(0);

  const speakMessage = useCallback(
    async (message: string) => {
      const text = message.trim();

      if (!text) {
        setSpeechStatus("error");
        setSpeechError("Дуу тоглуулах боломжгүй байна.");
        return;
      }

      const sequence = ++speechSequence.current;

      lastSpeechAt.current = Date.now();

      speechController.current?.abort();

      const controller = new AbortController();

      speechController.current = controller;

      const cacheKey =
        `${profile.voice}\u0000` + `${settings.speechSpeed}\u0000` + text;

      const audio = audioElement.current;

      audio?.pause();

      if (audio) {
        audio.currentTime = 0;
      }

      setSpeechError("");

      try {
        let audioUrl = speechCache.current.get(cacheKey);

        if (!audioUrl) {
          setSpeechStatus("loading");

          const response = await fetch("/api/tts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text,
              voice: profile.voice,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error("Speech generation failed.");
          }

          const blob = await response.blob();

          if (!blob.size || !blob.type.startsWith("audio/")) {
            throw new Error("Invalid audio response.");
          }

          audioUrl = URL.createObjectURL(blob);

          speechCache.current.set(cacheKey, audioUrl);
        }

        if (sequence !== speechSequence.current) {
          return;
        }

        const currentAudio = audioElement.current;

        if (!currentAudio) {
          throw new Error("Audio playback is unavailable.");
        }

        setSpeechStatus("idle");

        currentAudio.src = audioUrl;

        currentAudio.currentTime = 0;

        currentAudio.playbackRate = settings.speechSpeed === "Удаан" ? 0.86 : 1;

        await currentAudio.play();

        if (sequence === speechSequence.current) {
          setSpeechStatus("playing");
        }
      } catch {
        if (sequence !== speechSequence.current) {
          return;
        }

        setSpeechStatus("error");

        setSpeechError("Дуу тоглуулах боломжгүй байна.");
      } finally {
        if (sequence === speechSequence.current) {
          speechController.current = null;
        }
      }
    },
    [profile.voice, settings.speechSpeed]
  );

  const requestAssistantMessage = useCallback(
    async (state: SafetyState, mode: "guide" | "game" = "guide") => {
      const sequence = ++requestSequence.current;
      // The server answers a game request with guidance anyway unless the child is safe.
      const game = mode === "game" && state.riskLevel === "SAFE";

      requestController.current?.abort();

      const controller = new AbortController();

      requestController.current = controller;

      // Outside the zone the guidance screen is open, so even the offline message should
      // point the way home rather than say that everything is fine.
      const fallbackMessage = game
        ? getGameFallback(profile.userName)
        : !state.isInsideSafeZone && targetZone
          ? getGuidanceFallback(targetZone.name, profile.userName)
          : getSafetyFallback(state.riskLevel, profile.userName);

      speechSequence.current += 1;

      speechController.current?.abort();

      speechController.current = null;

      audioElement.current?.pause();

      if (audioElement.current) {
        audioElement.current.currentTime = 0;
      }

      setSpeechStatus("idle");
      setSpeechError("");

      // A game keeps the current words on screen until its own question arrives.
      if (!game) setAssistantMessage(fallbackMessage);

      setAssistantLoading(true);

      const input: SafetyAssistantRequest = {
        ...profile,

        riskLevel: state.riskLevel,

        riskScore: state.riskScore,

        insideSafeZone: state.isInsideSafeZone,

        routeDeviationMeters: state.routeDeviation ? null : 0,

        nearestSafeZone: state.nearestSafeZone.name,

        distanceFromSafeZone: state.distanceToNearestZoneMeters,

        destination: targetZone?.name ?? state.nearestSafeZone.name,

        nearbyLandmarks: [],

        ...(game ? { mode: "game" as const } : {}),

        ...(navigationInstruction
          ? {
              navigationInstruction,
            }
          : {}),
      };

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(input),

          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Assistant request failed.");
        }

        const result: unknown = await response.json();

        if (
          !result ||
          typeof result !== "object" ||
          !("message" in result) ||
          typeof result.message !== "string" ||
          !result.message.trim()
        ) {
          throw new Error("Assistant returned an empty message.");
        }

        if (sequence === requestSequence.current) {
          setAssistantMessage(result.message.trim());

          void speakMessage(result.message.trim());
        }
      } catch {
        if (sequence === requestSequence.current) {
          setAssistantMessage(fallbackMessage);

          void speakMessage(fallbackMessage);
        }
      } finally {
        if (sequence === requestSequence.current) {
          setAssistantLoading(false);
        }
      }
    },
    [navigationInstruction, profile, speakMessage, targetZone]
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
      setAssistantMessage(
        `${profile.userName}, чи ${targetZone.name} аюулгүй бүсэд байна. Ёстой гоё!`
      );
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
    )
      return;

    lastAutomaticRequest.current = automaticRequestKey;
    void requestAssistantMessage(safetyState);
  }, [
    automaticRequestKey,
    profile.userName,
    requestAssistantMessage,
    routeStatus,
    safetyState,
    targetZone,
  ]);

  // While the camera guides a safe walk, the companion starts a little game by itself now and
  // then. It waits for a quiet moment, so a turn instruction always comes first.
  const lastGameAt = useRef(0);
  const guidingSince = useRef<number | null>(null);
  const autoGameInputs = useRef({
    safetyState,
    busy: false,
    requestAssistantMessage,
  });
  useEffect(() => {
    autoGameInputs.current = {
      safetyState,
      busy:
        assistantLoading ||
        speechStatus === "loading" ||
        speechStatus === "playing",
      requestAssistantMessage,
    };
  });
  useEffect(() => {
    if (!guiding) return;
    guidingSince.current = Date.now();
    const interval = window.setInterval(() => {
      const {safetyState: state, busy, requestAssistantMessage: request} =
        autoGameInputs.current;
      if (!state || state.riskLevel !== "SAFE" || busy) return;
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - (guidingSince.current ?? now) < AUTO_GAME_FIRST_DELAY_MS) return;
      if (now - lastGameAt.current < AUTO_GAME_INTERVAL_MS) return;
      if (now - lastSpeechAt.current < AUTO_GAME_QUIET_MS) return;
      lastGameAt.current = now;
      void request(state, "game");
    }, AUTO_GAME_CHECK_MS);
    return () => window.clearInterval(interval);
  }, [guiding]);

  // The companion says the good news out loud, once per reached checkpoint.
  const announcedCheckpoint = useRef<string | null>(null);
  useEffect(() => {
    if (!celebrating || announcedCheckpoint.current === celebrating.id) return;
    announcedCheckpoint.current = celebrating.id;
    const reward = describeReward(celebrating.reward);
    void speakMessage(
      `Баяр хүргэе, ${profile.userName}! Чи ${celebrating.name} хүртэл алхаж очлоо. ${reward.label} одоо чинийх боллоо!`
    );
  }, [celebrating, profile.userName, speakMessage]);

  useEffect(() => {
    const audio = audioElement.current;
    const cachedSpeech = speechCache.current;

    return () => {
      requestController.current?.abort();

      speechController.current?.abort();

      audio?.pause();

      cachedSpeech.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const companionName = settings.name || "Мило";
  const companionMessage =
    assistantMessage ||
    (safetyState
      ? isOutsideSafeZone && targetZone
        ? getGuidanceFallback(targetZone.name, profile.userName)
        : getSafetyFallback(safetyState.riskLevel, profile.userName)
      : zonesLoadError ||
        (zonesLoaded && !demoMode && savedZones.length === 0
          ? "Асран хамгаалагчаасаа аюулгүй бүс тохируулж өгөхийг хүсээрэй."
          : "Байршил болон аюулгүй бүс ачаалж байна…"));
  const companionState =
    safetyState?.riskLevel === "HIGH_RISK" ||
    safetyState?.riskLevel === "WARNING"
      ? "warning"
      : speechStatus === "playing"
      ? "speaking"
      : "idle";

  return (
    <AppShell>
      <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-linear-to-b from-[#071116] via-[#0b151b] to-[#050a0e] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-[12%] size-64 rounded-full bg-[#06b6d4]/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-[#0e7490]/20 blur-3xl"
        />

        <header className="relative z-10 flex min-h-12 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <Link
              href="/"
              aria-label="Нүүр хуудас руу буцах"
              className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-[#d4e1e5] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
            >
              <ChevronLeft size={24} aria-hidden="true" />
            </Link>
            <div className="inline-flex items-center gap-2 text-[15px] font-bold tracking-[-0.02em]">
              <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.3)]">
                <svg
                  viewBox="0 0 24 24"
                  className="size-[22px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  aria-hidden="true"
                >
                  <path
                    d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="10" r="2.5" fill="currentColor" />
                </svg>
              </span>
              <span className="text-[18px] font-bold tracking-[-0.04em]">
                SafePath
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-2.5 py-1 text-[12px] font-bold text-amber-950"
              >
                <WifiOff size={13} aria-hidden="true" /> Интернетгүй
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (!demoMode) {
                  const start = demoZones[0];
                  setDemoLocation({
                    latitude: start.latitude,
                    longitude: start.longitude,
                    accuracy: 5,
                    lastUpdated: Date.now(),
                  });
                }
                setDemoMode((value) => !value);
              }}
              aria-pressed={demoMode}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-bold transition ${
                demoMode
                  ? "border-[#67e8f9] bg-[#0e7490] text-white"
                  : "border-[#67e8f9]/25 bg-[#101c22] text-[#b7c7cc]"
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  demoMode ? "bg-[#4ade80]" : "bg-[#60747b]"
                }`}
                aria-hidden="true"
              />
              Demo
            </button>
            <Link
              href="/tracker/code"
              aria-label="Тохиргоо"
              className="grid size-11 place-items-center rounded-full text-[#b7c7cc] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
            >
              <Settings size={20} />
            </Link>
          </div>
        </header>

        {/* The companion stays on screen in every state and speaks its own messages: large in the
           middle while calm, a small strip above the camera while guiding. */}
        <section
          aria-label={`${companionName} AI туслах`}
          className={`relative z-10 flex gap-2 ${
            guiding
              ? "items-center"
              : "flex-1 flex-col items-center justify-center"
          }`}
        >
          {/* Tapping the companion opens the screen where the child dresses and renames it. */}
          <Link
            href="/tracker/companion"
            aria-label={`AI найзаа өөрчлөх: ${companionName}`}
            className="relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#67e8f9]"
          >
            <CompanionMark
              state={companionState}
              avatar={shownAvatar}
              accessory={shownAccessory}
              custom={settings.custom}
              name={companionName}
              className={`companion-avatar--compact shrink-0 ${
                guiding ? "companion-avatar--mini" : ""
              }`}
            />
            {!guiding && (
              <span
                aria-hidden="true"
                className="absolute bottom-1 right-1 z-[3] grid size-8 place-items-center rounded-full bg-[#7c3aed] text-[15px] shadow-[0_4px_10px_rgba(0,0,0,.35)] ring-2 ring-[#07151b]"
              >
                ✏️
              </span>
            )}
          </Link>
          <div
            className={`flex min-w-0 items-center gap-2 ${
              guiding ? "flex-1" : "w-full"
            }`}
          >
            <p
              aria-live="polite"
              aria-busy={assistantLoading}
              className={`min-w-0 flex-1 rounded-2xl bg-[#10232b] font-semibold text-[#f1f7f8] ring-1 ring-[#67e8f9]/15 ${
                guiding
                  ? "rounded-tl-md px-3 py-2 text-[13px] leading-[18px]"
                  : "px-4 py-3 text-center text-[15px] leading-[22px]"
              }`}
            >
              {/* Clamp on an inner span so the border grows with the text and
                  no half-cut line leaks into the padding. */}
              <span
                className={`block break-words ${
                  guiding ? "line-clamp-3" : "line-clamp-4"
                }`}
              >
                {companionMessage}
              </span>
            </p>
            {safetyState?.riskLevel === "SAFE" && (
              <button
                type="button"
                disabled={assistantLoading}
                onClick={() => void requestAssistantMessage(safetyState, "game")}
                aria-label="Хамт тоглоом тоглох"
                className="grid size-12 shrink-0 place-items-center rounded-full bg-[#7c3aed] text-white shadow-[0_8px_20px_rgba(124,58,237,.3)] transition hover:bg-[#6d28d9] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]"
              >
                <Gamepad2 size={22} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              disabled={
                !safetyState || assistantLoading || speechStatus === "loading"
              }
              onClick={() => void speakMessage(assistantMessage)}
              aria-label={`Дахин сонсох: ${companionName}`}
              className="grid size-12 shrink-0 place-items-center rounded-full bg-[#0e7490] text-white shadow-[0_8px_20px_rgba(6,182,212,.25)] transition hover:bg-[#0c819d] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
              aria-label={`${companionName}-г дахин сонсох`}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0e7490] text-white shadow-[0_8px_20px_rgba(6,182,212,.25)] transition hover:bg-[#0c819d] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
            >
              {assistantLoading || speechStatus === "loading" ? (
                <SafePathLoading variant="button" />
              ) : speechError ? (
                <VolumeX size={18} aria-hidden="true" />
              ) : (
                <Volume2
                  size={18}
                  className={speechStatus === "playing" ? "animate-pulse" : ""}
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </section>

        {goal && (
          <CheckpointGoal goal={goal} location={currentLocation ?? null} compact={guiding} />
        )}

        {/* A small slanted map inside the Safe Zone; camera guidance takes over by itself once outside. */}
        <div
          className={`relative z-10 mt-3 overflow-hidden rounded-[28px] bg-[#101c22] ring-1 ring-[#67e8f9]/20 shadow-[0_18px_45px_rgba(0,0,0,.28)] ${
            guiding ? "min-h-[320px] flex-1" : "h-[220px] shrink-0"
          }`}
        >
          {guiding && currentLocation ? (
            <ArNavigationCamera
              location={currentLocation}
              route={route?.route ?? []}
              instruction={
                navigationInstruction ??
                route?.nextInstruction ??
                "Аюулгүй бүс рүү буцах зам тооцоолж байна…"
              }
              destinationName={targetZone?.name ?? "Аюулгүй бүс"}
              distanceMeters={route?.distanceMeters ?? null}
              autoStart
              voice={profile.voice}
              speechSpeed={settings.speechSpeed === "Удаан" ? "slow" : "normal"}
            />
          ) : currentLocation ? (
            <>
              {/* Turns with the compass so the way the person faces is always up. */}
              <TiltedPlane
                centerPercent={CALM_MAP_CENTER_PERCENT}
                heading={calmHeading}
              >
                <CompanionMap
                  location={currentLocation}
                  destination={targetZone ?? undefined}
                  currentRoute={route?.route ?? []}
                  variant="companion"
                  showCredit={false}
                />
              </TiltedPlane>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 z-[403] -translate-x-1/2 -translate-y-1/2"
                style={{top: `${CALM_MAP_CENTER_PERCENT}%`}}
              >
                {calmHeading === null ? (
                  <span className="block size-5 rounded-full border-[3px] border-white bg-[#0e7490] shadow-[0_0_0_8px_rgba(14,116,144,.25)]" />
                ) : (
                  <HeadingArrow />
                )}
              </span>
            </>
          ) : (
            <div
              role="status"
              className="absolute inset-x-5 bottom-5 rounded-2xl border border-[#67e8f9]/15 bg-[#071116]/85 px-3 py-2.5 text-[13px] leading-5 text-[#d4e1e5] backdrop-blur"
            >
              {locationStatus === "loading" ? (
                <SafePathLoading
                  className="flex-col gap-1"
                  label="Байршил тогтоож байна…"
                />
              ) : (
                locationError || "Байршлын зөвшөөрлөө шалгана уу."
              )}
            </div>
          )}
          {demoMode && (
            <DemoPad
              riskLevel={safetyState?.riskLevel ?? null}
              onMove={moveDemoLocation}
            />
          )}
        </div>

        <LocationSharingStatus />

        <section className="relative z-10 mt-2" aria-label="Яаралтай тусламж">
          {sosConfirm && !demoMode ? (
            <div className="rounded-2xl border border-rose-400/40 bg-[#140d12] p-3">
              <p className="text-center text-[14px] font-bold text-white">
                Асран хамгаалагчдаа SOS илгээх үү?
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSosConfirm(false)}
                  className="min-h-11 rounded-xl border border-white/15 px-3 text-[14px] font-semibold text-white"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={() => void sendSos()}
                  disabled={sosStatus === "sending"}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 text-[14px] font-bold text-white disabled:opacity-50"
                >
                  {sosStatus === "sending" && (
                    <SafePathLoading variant="button" />
                  )}
                  {sosStatus === "sending" ? "Илгээж байна…" : "Тийм, илгээх"}
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
              className="min-h-12 w-full rounded-2xl bg-rose-600 px-4 text-[15px] font-bold text-white shadow-[0_8px_24px_rgba(225,29,72,.22)] transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
            >
              🆘 SOS — Тусламж дуудах
            </button>
          )}
          {sosMessage && (
            <p
              role={sosStatus === "error" ? "alert" : "status"}
              className={`mt-2 rounded-xl px-3 py-2 text-center text-[13px] leading-5 ${
                sosStatus === "error"
                  ? "bg-rose-500/10 text-rose-200"
                  : sosStatus === "sent"
                  ? "bg-emerald-500/10 text-emerald-200"
                  : "text-[#d4e1e5]"
              }`}
            >
              {sosMessage}
            </p>
          )}
        </section>

        {celebrating && (
          <RewardCelebration
            checkpoint={celebrating}
            userName={profile.userName}
            onUse={() => {
              if (isAccessoryId(celebrating.reward)) update("accessory", celebrating.reward);
              else update("avatar", celebrating.reward);
              finishCelebration(celebrating.id);
            }}
            onClose={() => finishCelebration(celebrating.id)}
          />
        )}

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
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;
      const zone = item as Record<string, unknown>;
      return (
        typeof zone.id === "string" &&
        typeof zone.name === "string" &&
        typeof zone.latitude === "number" &&
        Number.isFinite(zone.latitude) &&
        typeof zone.longitude === "number" &&
        Number.isFinite(zone.longitude) &&
        typeof zone.radiusMeters === "number" &&
        Number.isFinite(zone.radiusMeters) &&
        zone.radiusMeters >= 50 &&
        zone.radiusMeters <= 2000
      );
    })
  );
}

// Automatic walking games: the first a little after guidance starts, then every few minutes,
// and only after the companion has been quiet for a while.
const AUTO_GAME_FIRST_DELAY_MS = 40_000;
const AUTO_GAME_INTERVAL_MS = 3 * 60_000;
const AUTO_GAME_QUIET_MS = 25_000;
const AUTO_GAME_CHECK_MS = 5_000;

const CELEBRATED_KEY = "safepath:celebrated-checkpoints";

/** Checkpoints whose celebration this phone already showed. */
function readCelebrated(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(CELEBRATED_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function getGuidanceFallback(zoneName: string, userName: string) {
  return `${userName}, ${zoneName} хүртэл хамт алхъя. Цэнхэр сумыг дагаад алхаарай, би чамтай хамт байна.`;
}

type DemoDirection = "up" | "down" | "left" | "right";

const DEMO_STATUS_COLORS: Record<SafetyState["riskLevel"], string> = {
  SAFE: "bg-[#4ade80]",
  WARNING: "bg-[#fbbf24]",
  HIGH_RISK: "bg-[#f43f5e]",
};

/** Small glass D-pad laid over the map that walks the demo location ~110 m per tap. */
function DemoPad({
  riskLevel,
  onMove,
}: {
  riskLevel: SafetyState["riskLevel"] | null;
  onMove: (direction: DemoDirection) => void;
}) {
  const arrow = (
    direction: DemoDirection,
    label: string,
    glyph: string,
    area: string
  ) => (
    <button
      type="button"
      onClick={() => onMove(direction)}
      aria-label={label}
      className={`grid size-7 place-items-center rounded-lg bg-white/10 text-[13px] text-white transition active:scale-90 active:bg-white/25 ${area}`}
    >
      {glyph}
    </button>
  );
  return (
    <div
      aria-label="Demo байршил хөдөлгөх"
      className="absolute bottom-3 left-3 z-[410] grid grid-cols-3 grid-rows-3 gap-0.5 rounded-xl bg-[#071116]/70 p-1 shadow-lg ring-1 ring-white/15 backdrop-blur-md"
    >
      {arrow("up", "Demo: хойд зүг рүү", "↑", "col-start-2")}
      {arrow("left", "Demo: баруун зүг рүү", "←", "col-start-1 row-start-2")}
      <span
        role="status"
        aria-label={`Demo төлөв: ${riskLevel ?? "тодорхойгүй"}`}
        className={`col-start-2 row-start-2 m-auto size-2.5 rounded-full ${
          riskLevel ? DEMO_STATUS_COLORS[riskLevel] : "bg-[#60747b]"
        }`}
      />
      {arrow("right", "Demo: зүүн зүг рүү", "→", "col-start-3 row-start-2")}
      {arrow("down", "Demo: урд зүг рүү", "↓", "col-start-2 row-start-3")}
    </div>
  );
}
