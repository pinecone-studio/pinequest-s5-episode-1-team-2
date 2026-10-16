"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  ChevronLeft,
  Footprints,
  Pencil,
  Siren,
  Settings,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import {LocationSharingStatus} from "@/components/location-sharing-status";
import {BackButton} from "@/components/back-button";
import ArNavigationCamera from "@/components/ar-navigation-camera";
import {HeadingArrow, TiltedPlane} from "@/components/tilted-plane";
import {AppShell, CompanionMark} from "@/components/safe-path";
import {CheckpointGoal, RewardCelebration} from "@/components/checkpoint-goal";
import {
  WalkingTaskCard,
  walkingTaskMessage,
  type WalkingTask,
} from "@/components/walking-task";
import {useCheckpoints} from "@/hooks/use-checkpoints";
import {
  buildOfflineRoute,
  loadOfflineZones,
  saveOfflineRoute,
  saveOfflineZones,
} from "@/lib/offline-guidance";
import {describeReward, effectiveAvatar, isAccessoryId} from "@/types/rewards";
import {SafePathLoading} from "@/components/safepath-loading";
import {useAssistantSettings} from "@/hooks/use-assistant-settings";
import {useCompassHeading} from "@/hooks/use-compass-heading";
import {useGeolocation} from "@/hooks/use-geolocation";
import {useNetworkStatus} from "@/hooks/use-network-status";
import {toCompanionProfile} from "@/lib/assistant-settings";
import {getSafetyFallback} from "@/lib/ai/fallback-messages";
import {calculateSafetyState} from "@/lib/risk-engine";
import {getSafeZoneProximities} from "@/lib/geofence";
import {stepsText} from "@/lib/kid-directions";
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

const GUIDANCE_START_DELAY_MS = 5_000;
const GUIDANCE_STOP_DELAY_MS = 15_000;
const CALM_MAP_CENTER_PERCENT = 70;
const CALM_MAP_MASK = "linear-gradient(to bottom, transparent 0%, transparent 20%, rgba(0,0,0,.5) 36%, #000 55%)";
const ZONES_POLL_MS = 30_000;

type RouteResult = {
  destination: {
    latitude: number;
    longitude: number;
  };
  route: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
  nextInstruction: string;
  /** True when worked out on the phone without the internet. */
  offline?: boolean;
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
  const {heading: calmHeading} = useCompassHeading(!guiding);
  const [savedZones, setSavedZones] = useState<SafeZone[]>([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [zonesLoadError, setZonesLoadError] = useState("");
  const [sosConfirm, setSosConfirm] = useState(false);
  const [sosStatus, setSosStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [sosMessage, setSosMessage] = useState("");

  // Polled, so a zone the guardian adds or removes reaches the child without reopening the page.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timer: number | undefined;

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
          saveOfflineZones(payload.zones);
        }
      } catch {
        if (!controller.signal.aborted && active) {
          // Without the internet, the zones saved on this phone still guide the child home.
          const saved = loadOfflineZones();
          if (saved) {
            setSavedZones(saved);
            setZonesLoadError("");
          } else {
            setZonesLoadError(
              "Аюулгүй бүсүүдийг ачаалж чадсангүй. Интернэтээ шалгана уу."
            );
          }
        }
      } finally {
        if (active) {
          setZonesLoaded(true);
          timer = window.setTimeout(loadSavedZones, ZONES_POLL_MS);
        }
      }
    }

    void loadSavedZones();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  const [demoLocation, setDemoLocation] = useState({
    latitude: SAFE_ZONES[0].latitude,
    longitude: SAFE_ZONES[0].longitude,
    accuracy: 5,
    lastUpdated: 0,
  });