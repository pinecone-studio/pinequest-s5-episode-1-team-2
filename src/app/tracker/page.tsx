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
import type { SafetyAssistantRequest, SafetyState } from "@/types/safety";
const CompanionMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => <p className="absolute inset-x-4 bottom-5 text-xs text-[#737373]">Газрын зураг ачаалж байна…</p>,
});

type SpeechStatus = "idle" | "loading" | "playing" | "error";

export default function TrackerPage() {
  const { location, status: locationStatus, error: locationError } = useGeolocation();
  const { settings } = useAssistantSettings();
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
  const profile = useMemo(() => toCompanionProfile(settings), [settings]);
  const navigationInstruction: string | undefined = undefined;
  const currentLocation = location;
  const routeDeviation = false;
  const safetyState = useMemo(
    () => currentLocation ? calculateSafetyState({ location: currentLocation, routeDeviation }) : null,
    [currentLocation, routeDeviation],
  );

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
    const cacheKey = `${profile.voice}\u0000${settings.speechSpeed}\u0000${text}`;
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
          body: JSON.stringify({ text, voice: profile.voice }),
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
      currentAudio.playbackRate = settings.speechSpeed === "Удаан" ? 0.86 : 1;
      await currentAudio.play();
      if (sequence === speechSequence.current) setSpeechStatus("playing");
    } catch {
      if (sequence !== speechSequence.current) return;
      setSpeechStatus("error");
      setSpeechError("Дуу тоглуулах боломжгүй байна.");
    } finally {
      if (sequence === speechSequence.current) speechController.current = null;
    }
  }, [profile.voice, settings.speechSpeed]);

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
      <main className="flex min-h-dvh flex-col px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
        <header className="flex min-h-16 items-center">
          <Link href="/" className="inline-flex min-h-11 items-center text-[17px] font-semibold tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">SafePath</Link>
        </header>

        <section className="flex flex-1 flex-col items-center pb-5 text-center" aria-label="Милотой ярилцах">
          <div className="relative mt-2 flex h-[clamp(300px,47dvh,440px)] w-full shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-[#e7e7e5] bg-[#f2f2ef]">
            {location ? (
              <CompanionMap location={location} variant="companion" />
            ) : (
              <p role="status" className="absolute inset-x-5 bottom-5 text-xs leading-5 text-[#737373]">
                {locationStatus === "loading" ? "Байршил тогтоож байна…" : locationError || "Байршлын зөвшөөрлөө шалгана уу."}
              </p>
            )}
            <CompanionMark
              state={safetyState?.riskLevel === "HIGH_RISK" || safetyState?.riskLevel === "WARNING" ? "warning" : speechStatus === "playing" ? "speaking" : "idle"}
              avatar={settings.avatar}
              name={settings.name || "Мило"}
              className="companion-avatar--compact relative z-10"
            />
          </div>
          <p className="text-[16px] font-medium text-[#737373]">{settings.name || "Мило"}</p>
          <p aria-live="polite" aria-busy={assistantLoading} className="mx-auto mt-3 max-w-[320px] text-[17px] leading-7 tracking-[-0.01em] text-[#292a27]">
            {assistantMessage || (safetyState ? getSafetyFallback(safetyState.riskLevel, profile.userName) : "Байршил тогтоож байна…")}
          </p>
          {assistantLoading && <span className="mt-3 text-sm text-[#737373]">Мило бодож байна…</span>}
          {speechStatus === "loading" && <span className="mt-2 text-sm text-[#737373]">Дуу бэлдэж байна…</span>}
          {speechStatus === "playing" && <span className="mt-2 text-sm text-[#737373]">Мило ярьж байна…</span>}
          {speechError && <span role="status" className="mt-2 text-sm text-[#737373]">{speechError}</span>}

          {navigationInstruction && <div className="mt-7 flex items-center gap-4 rounded-2xl bg-[#f1f1ee] px-5 py-4 text-left"><span className="text-3xl" aria-hidden="true">↑</span><div><p className="font-semibold">Урагшаа яв</p><p className="mt-0.5 text-sm text-[#737373]">80 м</p></div></div>}
        </section>

        <div className="pt-2">
          <button
            type="button"
            disabled={!safetyState || assistantLoading || speechStatus === "loading"}
            onClick={() => void speakMessage(assistantMessage)}
            aria-label="Милогийн зөвлөгөөг сонсох"
            className="w-full min-h-[54px] rounded-2xl bg-[#111111] px-4 text-[15px] font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
          >
            {assistantLoading ? "Мило бодож байна…" : speechStatus === "loading" ? "Дуу бэлдэж байна…" : speechStatus === "playing" ? "Ярьж байна…" : "Ярих"}
          </button>
        </div>

        <a href="tel:+97600000000" className="mx-auto mt-2 inline-flex min-h-11 items-center px-4 text-[14px] font-medium text-[#737373] underline decoration-[#c8c8c4] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">Тусламж хэрэгтэй</a>
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
