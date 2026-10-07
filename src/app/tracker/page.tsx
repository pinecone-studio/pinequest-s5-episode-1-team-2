"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, CompanionMark, StatusIndicator } from "@/components/safe-path";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { useGeolocation } from "@/hooks/use-geolocation";
import { DEMO_SAFETY_SCENARIOS, getDemoSafetyLocation, isDemoRouteDeviation } from "@/lib/demo-simulation";
import { toCompanionProfile } from "@/lib/assistant-settings";
import { getSafetyFallback } from "@/lib/ai/fallback-messages";
import { calculateSafetyState } from "@/lib/risk-engine";
import { SAFE_ZONES } from "@/lib/safe-zones";
import type { SafetyAssistantRequest, SafetyStatus, SafetyState } from "@/types/safety";
import type { DemoSafetyScenario } from "@/lib/demo-simulation";

const LiveMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => <MapMessage>Газрын зураг ачаалж байна…</MapMessage>,
});

type DemoSelection = "live" | DemoSafetyScenario;
type SpeechStatus = "idle" | "loading" | "playing" | "error";

const statusColor: Record<SafetyStatus, string> = {
  SAFE: "text-[#238636]",
  WARNING: "text-[#b26a00]",
  HIGH_RISK: "text-[#d1242f]",
};

export default function TrackerPage() {
  const { location, status: locationStatus, error } = useGeolocation();
  const { settings } = useAssistantSettings();
  const [demoSelection, setDemoSelection] = useState<DemoSelection>("live");
  const [assistantMessage, setAssistantMessage] = useState("Байршил тогтоож байна…");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("idle");
  const [speechError, setSpeechError] = useState("");
  const lastAutomaticRequest = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const speechSequence = useRef(0);
  const speechController = useRef<AbortController | null>(null);
  const speechCache = useRef(new Map<string, string>());
  const audioElement = useRef<HTMLAudioElement | null>(null);
  const isDevelopment = process.env.NODE_ENV === "development";
  const profile = useMemo(() => toCompanionProfile(settings), [settings]);
  const navigationInstruction: string | undefined = undefined;
  const simulatedLocation = useMemo(
    () => (demoSelection === "live" ? null : getDemoSafetyLocation(demoSelection)),
    [demoSelection],
  );
  const currentLocation = simulatedLocation ?? location;
  const routeDeviation = demoSelection !== "live" && isDemoRouteDeviation(demoSelection);
  const safetyState = useMemo(
    () => currentLocation ? calculateSafetyState({ location: currentLocation, routeDeviation }) : null,
    [currentLocation, routeDeviation],
  );
  const status = safetyState?.riskLevel ?? "SAFE";

  const speakMessage = useCallback(async (message: string) => {
    const text = message.trim();
    if (!text) {
      setSpeechStatus("error");
      setSpeechError("Дуу тоглуулах боломжгүй байна.");
      return;
    }

    const sequence = ++speechSequence.current;
    speechController.current?.abort();
    const controller = new AbortController();
    speechController.current = controller;
    const voiceId = profile.voiceId;
    const cacheKey = `${voiceId ?? "default"}\u0000${text}`;
    const audio = audioElement.current;
    audio?.pause();
    if (audio) audio.currentTime = 0;
    setSpeechError("");

    try {
      let audioUrl = speechCache.current.get(cacheKey);
      if (!audioUrl) {
        setSpeechStatus("loading");
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, ...(voiceId ? { voiceId } : {}) }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Speech generation failed.");

        const blob = await response.blob();
        if (!blob.size || !blob.type.startsWith("audio/")) throw new Error("Invalid audio response.");
        audioUrl = URL.createObjectURL(blob);
        speechCache.current.set(cacheKey, audioUrl);
      }

      if (sequence !== speechSequence.current) return;
      const currentAudio = audioElement.current;
      if (!currentAudio) throw new Error("Audio playback is unavailable.");
      setSpeechStatus("idle");
      currentAudio.src = audioUrl;
      currentAudio.currentTime = 0;
      await currentAudio.play();
      if (sequence === speechSequence.current) setSpeechStatus("playing");
    } catch {
      if (sequence !== speechSequence.current) return;
      setSpeechStatus("error");
      setSpeechError("Дуу тоглуулах боломжгүй байна.");
    } finally {
      if (sequence === speechSequence.current) speechController.current = null;
    }
  }, [profile.voiceId]);

  const requestAssistantMessage = useCallback(async (state: SafetyState) => {
    const sequence = ++requestSequence.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const fallbackMessage = getSafetyFallback(state.riskLevel, profile.userName);
    speechSequence.current += 1;
    speechController.current?.abort();
    speechController.current = null;
    audioElement.current?.pause();
    if (audioElement.current) audioElement.current.currentTime = 0;
    setSpeechStatus("idle");
    setSpeechError("");
    setAssistantMessage(fallbackMessage);
    setAssistantLoading(true);

    const input: SafetyAssistantRequest = {
      ...profile,
      riskLevel: state.riskLevel,
      riskScore: state.riskScore,
      insideSafeZone: state.isInsideSafeZone,
      routeDeviationMeters: state.routeDeviation ? null : 0,
      nearestSafeZone: state.nearestSafeZone.name,
      distanceFromSafeZone: state.distanceToNearestZoneMeters,
      destination: null,
      ...(navigationInstruction ? { navigationInstruction } : {}),
    };

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Assistant request failed.");

      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("message" in result) || typeof result.message !== "string" || !result.message.trim()) {
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
      if (sequence === requestSequence.current) setAssistantLoading(false);
    }
  }, [navigationInstruction, profile, speakMessage]);

  const automaticRequestKey = safetyState
    ? `${safetyState.riskLevel}:${safetyState.routeDeviation}:${navigationInstruction ?? ""}`
    : null;

  useEffect(() => {
    if (!safetyState || !automaticRequestKey || lastAutomaticRequest.current === automaticRequestKey) return;
    lastAutomaticRequest.current = automaticRequestKey;
    void requestAssistantMessage(safetyState);
  }, [automaticRequestKey, requestAssistantMessage, safetyState]);

  useEffect(() => () => {
    requestController.current?.abort();
    speechController.current?.abort();
    audioElement.current?.pause();
    speechCache.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  return (
    <AppShell>
      <main className="flex min-h-dvh flex-col px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
        <header className="flex min-h-16 items-center justify-between px-1">
          <Link href="/" className="inline-flex min-h-11 items-center text-[17px] font-semibold tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">SafePath</Link>
          {safetyState && <StatusIndicator status={safetyState.riskLevel} />}
        </header>

        <section className="flex items-center gap-4 px-1 pb-5 pt-2">
          <div className={speechStatus === "playing" ? "rounded-full ring-2 ring-[#b8b8b3] ring-offset-2 motion-safe:animate-pulse" : "rounded-full"}>
            <CompanionMark />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#737373]">{settings.name}</p>
            <h1 aria-live="polite" className={`mt-1 text-[26px] font-semibold tracking-[-0.035em] ${statusColor[status]}`}>
              {safetyState ? getStatusTitle(safetyState.riskLevel) : "БАЙРШИЛ"}
            </h1>
            <p aria-live="polite" aria-busy={assistantLoading} className="mt-1 text-[15px] leading-5 text-[#737373]">
              {assistantMessage || (safetyState ? getSafetyFallback(safetyState.riskLevel, profile.userName) : "Байршил тогтоож байна…")}
            </p>
            {assistantLoading && <span className="mt-1 block text-xs text-[#a0a0a0]">Зөвлөмж бэлдэж байна…</span>}
            {speechStatus === "loading" && <span className="mt-1 block text-xs text-[#a0a0a0]">Дуу бэлдэж байна…</span>}
            {speechStatus === "playing" && <span className="mt-1 block text-xs text-[#737373]">Ярьж байна…</span>}
            {speechError && <span role="status" className="mt-1 block text-xs text-[#737373]">{speechError}</span>}
          </div>
        </section>

        {currentLocation ? (
          <LiveMap location={currentLocation} safeZones={SAFE_ZONES} className="min-h-[350px] flex-1" />
        ) : (
          <MapMessage>{locationStatus === "loading" ? "Байршил тогтоож байна…" : error}</MapMessage>
        )}

        {safetyState && currentLocation && (
          <section className="flex min-h-12 items-center justify-between gap-3 border-b border-[#e8e8e5] px-1 text-xs text-[#737373]" aria-label="Аюулгүй бүсийн мэдээлэл" aria-live="polite">
            <span className="truncate">
              {safetyState.isInsideSafeZone
                ? `${safetyState.nearestSafeZone.name} · Аюулгүй бүсэд байна`
                : `Ойр бүс: ${safetyState.nearestSafeZone.name} · ${safetyState.distanceToNearestZoneMeters} м`}
            </span>
            <span className="shrink-0">Эрсдэл {safetyState.riskScore}/100</span>
          </section>
        )}

        {currentLocation && (
          <div className="flex min-h-9 items-center justify-between gap-3 px-1 pt-2 text-xs text-[#737373]" aria-live="polite">
            <span>{simulatedLocation ? "Demo байршил" : "Байршил шинэчлэгдсэн"}</span>
            <time>{formatUpdatedTime(currentLocation.lastUpdated)}</time>
          </div>
        )}

        {currentLocation && error && !simulatedLocation && <p className="px-1 pb-1 text-xs leading-5 text-[#d1242f]">{error}</p>}

        {isDevelopment && (
          <label className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-[#e8e8e5] px-1 pt-2 text-xs text-[#737373]">
            <span className="shrink-0 font-medium">DEMO</span>
            <select
              value={demoSelection}
              onChange={(event) => setDemoSelection(event.target.value as DemoSelection)}
              aria-label="Demo аюулгүй байдлын төлөв"
              className="min-h-10 max-w-[250px] rounded-xl border border-[#deded9] bg-white px-3 text-sm text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
            >
              <option value="live">Бодит GPS</option>
              {(Object.entries(DEMO_SAFETY_SCENARIOS) as [DemoSafetyScenario, (typeof DEMO_SAFETY_SCENARIOS)[DemoSafetyScenario]][]).map(([scenario, definition]) => (
                <option key={scenario} value={scenario}>{definition.label}</option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-2 pt-3">
          <button
            type="button"
            disabled={!safetyState || assistantLoading || speechStatus === "loading"}
            onClick={() => void speakMessage(assistantMessage)}
            className="min-h-13 rounded-2xl bg-[#111111] px-4 text-[15px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
          >
            {assistantLoading ? "Зөвлөмж бэлдэж байна…" : speechStatus === "loading" ? "Дуу бэлдэж байна…" : "Дахин хэлэх"}
          </button>
          <Link href="/guardian" className="inline-flex min-h-13 items-center justify-center rounded-2xl bg-[#f6f6f4] px-3 text-center text-[15px] font-semibold hover:bg-[#ededeb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">Асран хамгаалагч</Link>
        </div>

        <button type="button" className="mx-auto mt-2 min-h-11 px-4 text-[15px] font-semibold text-[#d1242f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1242f]">Тусламж</button>
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

function getStatusTitle(status: SafetyStatus) {
  if (status === "HIGH_RISK") return "ӨНДӨР ЭРСДЭЛ";
  if (status === "WARNING") return "АНХААР";
  return "АЮУЛГҮЙ";
}

function MapMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[350px] flex-1 flex-col items-center justify-center rounded-[24px] border border-[#e8e8e5] bg-[#f6f6f4] px-8 text-center text-[15px] leading-6 text-[#737373]">
      {children}
    </div>
  );
}

function formatUpdatedTime(timestamp: number) {
  return new Intl.DateTimeFormat("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}
