"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useCompassHeading } from "@/hooks/use-compass-heading";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { Camera, CameraOff, ChevronLeft, ChevronRight, Compass, Flag, Navigation2, ScanEye, Sparkles, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { SafePathLoading } from "@/components/safepath-loading";
import { HeadingArrow, TiltedPlane } from "@/components/tilted-plane";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type RoutePoint = [number, number];

type ArNavigationCameraProps = {
  location: Coordinate;
  route: RoutePoint[];
  instruction: string;
  destinationName: string;
  distanceMeters: number | null;
  autoStart?: boolean;
  onAutoStartAttempted?: () => void;
  voice?: "female" | "male";
  speechSpeed?: "normal" | "slow";
};

type DeviceOrientationPermissionApi = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const EARTH_RADIUS_METERS = 6_371_000;

// Rough half-width of a phone's rear camera view in portrait; used to place the destination sign.
const CAMERA_HALF_FOV_DEGREES = 28;

// Distance of each chevron group along the virtual ground plane (px), nearest first.
const CHEVRON_DISTANCES = [0, 290, 560];
const CHEVRON_WIDTH = 160;
// Chevrons are drawn longer than wide so they still read clearly once the ground plane squashes them.
const CHEVRON_STRETCH = 1.6;
const CHEVRON_LENGTH = CHEVRON_WIDTH * CHEVRON_STRETCH;

// Strongest bend the ground path shows; bigger turns are spelled out in the banner instead.
const MAX_PATH_BEND_DEGREES = 40;

// The mini-map dome's height: a share of the camera view, within fixed bounds.
const DOME_MIN_PX = 118;
const DOME_RATIO = 0.28;
const DOME_MAX_PX = 172;

// Shared by every overlay: the dome's height and roughly where the ground meets the sky.
const AR_LAYOUT_VARIABLES = {
  "--ar-dome": `clamp(${DOME_MIN_PX}px, ${DOME_RATIO * 100}%, ${DOME_MAX_PX}px)`,
  "--ar-horizon": "47%",
} as CSSProperties;

// Where the nearest chevron touches the ground, just above the dome.
const GROUND_ANCHOR = "calc(100% - var(--ar-dome) - 1.25rem)";
// Vertical space (px) the full-size path needs between the banner and the dome.
const GROUND_DESIGN_HEIGHT = 240;
// Height (px) reserved for the top banner.
const BANNER_RESERVE_PX = 112;

const CameraMiniMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => <SafePathLoading tone="light" className="h-full w-full bg-[#f4f5f3]" label="Газрын зураг ачаалж байна…" />,
});

function distanceMeters(from: Coordinate, to: Coordinate): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(from: Coordinate, to: Coordinate): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const degrees = (value: number) => (value * 180) / Math.PI;
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

function pickLookAheadPoint(location: Coordinate, route: RoutePoint[]): Coordinate | null {
  if (route.length < 2) return null;

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  route.forEach(([latitude, longitude], index) => {
    const distance = distanceMeters(location, { latitude, longitude });
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  // Aim a little ahead on the route rather than at the nearest point directly under the GPS dot.
  for (let index = nearestIndex; index < route.length; index += 1) {
    const [latitude, longitude] = route[index];
    if (distanceMeters(location, { latitude, longitude }) >= 20 || index === route.length - 1) {
      return { latitude, longitude };
    }
  }

  const [latitude, longitude] = route[route.length - 1];
  return { latitude, longitude };
}

function formatDistance(distance: number | null): string {
  if (distance === null || !Number.isFinite(distance)) return "";
  if (distance < 1000) return `${Math.max(0, Math.round(distance))} м`;
  return `${(distance / 1000).toFixed(1)} км`;
}

const OFFLINE_SCENE_ERROR = "Интернет тасарсан тул AI орчны танилт түр зогслоо. Сүлжээ сэргэсний дараа дахин оролдоно уу.";
const OFFLINE_SPEECH_ERROR = "Интернет холболтгүй байна. Дууны заавар авахын тулд сүлжээгээ сэргээнэ үү.";

const CHEVRON_PATHS = [16, 74, 132].map((top) => {
  const y = (value: number) => Math.round(value * CHEVRON_STRETCH);
  return `M120 ${y(top)} 220 ${y(top + 58)} 220 ${y(top + 90)} 120 ${y(top + 34)} 20 ${y(top + 90)} 20 ${y(top + 58)}Z`;
});

// Three stacked chevrons drawn flat; the ground plane supplies the perspective. Layers from the
// bottom: soft ground shadow, dark extruded side, blue rim, white top face.
function ChevronGroup() {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox={`0 0 240 ${240 * CHEVRON_STRETCH}`} aria-hidden="true" className="block size-full overflow-visible">
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dce9ff" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <g fill="#001a44" opacity=".4" filter={`url(#${id}-shadow)`} transform="translate(0 26)">
        {CHEVRON_PATHS.map((d) => <path key={d} d={d} />)}
      </g>
      <g fill="#0a4cc0" stroke="#0a4cc0" strokeWidth="22" strokeLinejoin="round" transform="translate(0 18)">
        {CHEVRON_PATHS.map((d) => <path key={d} d={d} />)}
      </g>
      <g fill="#2a7fff" stroke="#2a7fff" strokeWidth="22" strokeLinejoin="round">
        {CHEVRON_PATHS.map((d) => <path key={d} d={d} />)}
      </g>
      <g fill={`url(#${id}-face)`}>
        {CHEVRON_PATHS.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}

// Chevron groups laid on a CSS 3D ground plane so they shrink toward the horizon like the real
// pavement. `bend` (degrees) curves the path toward the next route point; `scale` shrinks the
// whole path on short screens so it never climbs into the banner.
function GroundPath({ bend, muted, scale }: { bend: number; muted: boolean; scale: number }) {
  const farthest = CHEVRON_DISTANCES[CHEVRON_DISTANCES.length - 1] + CHEVRON_LENGTH / 2;
  // A parabola keeps the nearest chevron pointing ahead while the far ones swing into the turn.
  const curvature = Math.tan((bend * Math.PI) / 180) / (2 * farthest);

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 overflow-hidden transition-opacity duration-500 ${muted ? "opacity-55" : "opacity-100"}`}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          // The vanishing point sits a fixed distance above the anchor so the path keeps its shape at any height.
          perspective: "560px",
          perspectiveOrigin: `50% calc(${GROUND_ANCHOR} - 105px)`,
          transform: `scale(${scale.toFixed(3)})`,
          transformOrigin: `50% ${GROUND_ANCHOR}`,
        }}
      >
        <div
          className="absolute left-1/2"
          style={{ top: GROUND_ANCHOR, transformStyle: "preserve-3d", transform: "rotateX(74deg)" }}
        >
          {/* Far groups first so nearer ones paint over them. */}
          {CHEVRON_DISTANCES.map((distance, index) => ({ distance, index })).reverse().map(({ distance, index }) => {
            const center = distance + CHEVRON_LENGTH / 2;
            const offset = curvature * center * center;
            const angle = (Math.atan(2 * curvature * center) * 180) / Math.PI;
            return (
              <div
                key={index}
                className="absolute left-0 top-0 transition-transform duration-300 ease-out"
                style={{
                  width: CHEVRON_WIDTH,
                  height: CHEVRON_LENGTH,
                  transform: `translate3d(${(offset - CHEVRON_WIDTH / 2).toFixed(1)}px, ${-distance - CHEVRON_LENGTH}px, 0) rotate(${angle.toFixed(1)}deg)`,
                }}
              >
                <ChevronGroup />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PinMark() {
  return (
    <svg viewBox="0 0 24 32" aria-hidden="true" className="h-8 w-6 shrink-0 drop-shadow-[0_2px_2px_rgba(0,0,0,.25)]">
      <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 32 12 32s12-11.6 12-20.3C24 5.2 18.6 0 12 0Z" fill="#ff4d4f" />
      <circle cx="12" cy="11.5" r="4.6" fill="#ffffff" />
    </svg>
  );
}

// Compact pill that sits on the dome's rim, so the actions cost no space above the path.
function ArControl({ label, active = false, disabled = false, onClick, ariaPressed, children }: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaPressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      className={`pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full pl-3 pr-4 text-[14px] font-bold text-white shadow-[0_6px_18px_rgba(0,0,0,.35)] ring-1 backdrop-blur-md transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${active ? "bg-emerald-600 ring-emerald-100/60" : "bg-[#0b1620]/85 ring-white/20 enabled:hover:bg-[#16293a]"}`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

export default function ArNavigationCamera({
  location,
  route,
  instruction,
  destinationName,
  distanceMeters: remainingDistance,
  autoStart = false,
  onAutoStartAttempted,
  voice = "female",
  speechSpeed = "normal",
}: ArNavigationCameraProps) {
  const isOnline = useNetworkStatus();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneAbortRef = useRef<AbortController | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestInFlightRef = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [permissionNote, setCompassNote] = useState("Утсаа хөдөлгөж луужинг тохируулна уу.");
  const { heading, problem: compassProblem } = useCompassHeading(compassEnabled);
  const compassNote = compassProblem || permissionNote;
  const [isAnalyzingScene, setIsAnalyzingScene] = useState(false);
  const [sceneDescription, setSceneDescription] = useState("");
  const [sceneError, setSceneError] = useState("");
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [speechError, setSpeechError] = useState("");
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const speechSequenceRef = useRef(0);
  const speechObjectUrlRef = useRef<string | null>(null);
  const lastAnnouncedInstructionRef = useRef("");
  // The mini-map never reads lastUpdated; a stable timestamp keeps render pure.
  const [mountedAt] = useState(() => Date.now());
  const rootRef = useRef<HTMLDivElement>(null);
  const [rootHeight, setRootHeight] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => setRootHeight(entry.contentRect.height));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const domeHeight = Math.min(DOME_MAX_PX, Math.max(DOME_MIN_PX, rootHeight * DOME_RATIO));
  const groundScale = rootHeight
    ? Math.max(0.5, Math.min(1, (rootHeight - domeHeight - BANNER_RESERVE_PX) / GROUND_DESIGN_HEIGHT))
    : 1;

  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;

    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraError("Камерын дүрсийг тоглуулж чадсангүй. Камерын зөвшөөрлөө шалгаарай.");
    });

    return () => {
      stream.getTracks().forEach((track) => track.stop());
      if (activeStreamRef.current === stream) activeStreamRef.current = null;
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  // Keep the screen awake while the camera guides the person; released automatically when hidden.
  useEffect(() => {
    if (!stream || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock.request("screen").then((lock) => {
      if (cancelled) void lock.release().catch(() => {});
      else sentinel = lock;
    }).catch(() => {
      // Wake lock is a convenience; navigation still works without it.
    });
    return () => {
      cancelled = true;
      void sentinel?.release().catch(() => {});
    };
  }, [stream]);

  const target = useMemo(() => pickLookAheadPoint(location, route), [location, route]);
  const targetBearing = useMemo(
    () => (target ? bearingDegrees(location, target) : null),
    [location, target],
  );
  const relativeBearing =
    targetBearing !== null && heading !== null
      ? ((targetBearing - heading + 540) % 360) - 180
      : null;
  const routeDestination = route.length
    ? { latitude: route[route.length - 1][0], longitude: route[route.length - 1][1] }
    : target;
  const miniMapLocation = useMemo(
    () => ({
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: 10,
      lastUpdated: mountedAt,
    }),
    [location.latitude, location.longitude, mountedAt],
  );
  const pathBend = relativeBearing === null
    ? 0
    : Math.max(-MAX_PATH_BEND_DEGREES, Math.min(MAX_PATH_BEND_DEGREES, relativeBearing));
  // The sign floats over the destination's real direction and pins to the screen edge when it is out of view.
  const destinationRelative = routeDestination && heading !== null
    ? ((bearingDegrees(location, routeDestination) - heading + 540) % 360) - 180
    : null;
  const signShift = destinationRelative === null
    ? 0
    : Math.max(-1, Math.min(1, destinationRelative / CAMERA_HALF_FOV_DEGREES));
  const signEdge = destinationRelative === null || Math.abs(destinationRelative) <= CAMERA_HALF_FOV_DEGREES
    ? null
    : destinationRelative > 0 ? "right" : "left";
  const isNearDestination = remainingDistance !== null && remainingDistance < 15;
  const isFacingAway = relativeBearing !== null && Math.abs(relativeBearing) > 135;
  const directionLabel = isNearDestination
    ? "Зорьсон газартаа ойртлоо"
    : relativeBearing === null
      ? (route.length < 2 ? "Зам тооцоолж байна…" : "Луужинг уншиж байна…")
      : Math.abs(relativeBearing) < 18
        ? "Шулуун чигээрээ яваарай"
        : isFacingAway
          ? "Эргээд буцаж яваарай"
          : relativeBearing > 0
            ? "Баруун тийш чиглээрэй"
            : "Зүүн тийш чиглээрэй";
  const routeInstruction = instruction || "Аюулгүй бүс рүү буцах замыг тооцоолж байна…";
  // One banner: the route step leads, and the compass hint takes over only when it matters more.
  const bannerTitle = isNearDestination || isFacingAway ? directionLabel : routeInstruction;
  const bannerDetail = isNearDestination
    ? destinationName
    : isFacingAway
      ? routeInstruction
      : heading !== null
        ? directionLabel
        : stream ? compassNote : "";
  const bannerTone = isNearDestination
    ? "bg-emerald-700/90 ring-emerald-200/30"
    : isFacingAway
      ? "bg-amber-600/90 ring-amber-100/30"
      : "bg-[#0b1620]/80 ring-white/10";

  const stopSpeech = useCallback(() => {
    speechSequenceRef.current += 1;
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    const audio = speechAudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (speechObjectUrlRef.current) {
      URL.revokeObjectURL(speechObjectUrlRef.current);
      speechObjectUrlRef.current = null;
    }
    setSpeechStatus("idle");
  }, []);

  const playSpeech = useCallback(async (text: string) => {
    const normalizedText = text.replace(/\s+/g, " ").trim().slice(0, 260);
    if (!normalizedText) return;
    if (!isOnline) {
      setSpeechStatus("error");
      setSpeechError(OFFLINE_SPEECH_ERROR);
      return;
    }

    speechAbortRef.current?.abort();
    const controller = new AbortController();
    speechAbortRef.current = controller;
    const sequence = ++speechSequenceRef.current;
    const audio = speechAudioRef.current;
    if (!audio) {
      setSpeechError("Дуу тоглуулах боломжгүй байна. Дэлгэцээ дахин нээнэ үү.");
      setSpeechStatus("error");
      return;
    }

    audio.pause();
    if (speechObjectUrlRef.current) {
      URL.revokeObjectURL(speechObjectUrlRef.current);
      speechObjectUrlRef.current = null;
    }
    audio.removeAttribute("src");
    audio.load();
    setSpeechError("");
    setSpeechStatus("loading");

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: normalizedText, voice }),
        signal: controller.signal,
      });
      if (!response.ok) {
        let message = "Дууны үйлчилгээ ажиллахгүй байна.";
        try {
          const payload: unknown = await response.json();
          if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
            const serverMessage = payload.error;
            message = serverMessage === "Speech is not configured."
              ? "Монгол хэлний дууны үйлчилгээ тохируулаагүй байна."
              : serverMessage === "Too many requests."
                ? "Дууны хүсэлт олон байна. Түр хүлээгээд дахин оролдоно уу."
                : serverMessage === "Unauthorized."
                  ? "Дуугаар заавар авахын тулд дахин нэвтэрнэ үү."
                  : "Дууны үйлчилгээ түр ажиллахгүй байна.";
          }
        } catch {
          // Keep the safe generic message if the API does not return JSON.
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      if (!blob.size || !blob.type.startsWith("audio/")) {
        throw new Error("Дууны өгөгдөл буруу байна.");
      }
      if (sequence !== speechSequenceRef.current || controller.signal.aborted) return;
      const objectUrl = URL.createObjectURL(blob);
      speechObjectUrlRef.current = objectUrl;
      audio.src = objectUrl;
      audio.currentTime = 0;
      audio.playbackRate = speechSpeed === "slow" ? 0.86 : 1;
      await audio.play();
      if (sequence === speechSequenceRef.current) setSpeechStatus("playing");
    } catch (error) {
      if (controller.signal.aborted || sequence !== speechSequenceRef.current) return;
      setSpeechStatus("error");
      setSpeechError(error instanceof Error ? error.message : "Дууг тоглуулж чадсангүй. Интернетээ шалгана уу.");
    } finally {
      if (sequence === speechSequenceRef.current) speechAbortRef.current = null;
    }
  }, [isOnline, speechSpeed, voice]);

  useEffect(() => {
    const text = instruction.replace(/\s+/g, " ").trim();
    if (!voiceGuidanceEnabled || !text || text === lastAnnouncedInstructionRef.current) return;
    lastAnnouncedInstructionRef.current = text;
    void playSpeech(text);
  }, [instruction, playSpeech, voiceGuidanceEnabled]);

  useEffect(() => () => {
    speechAbortRef.current?.abort();
    const audio = speechAudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    if (speechObjectUrlRef.current) URL.revokeObjectURL(speechObjectUrlRef.current);
  }, []);

  // Camera and remote AI/audio requests are not reliable or appropriate while the app is
  // backgrounded. Stop the camera on hide and require the person to explicitly turn it on again.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;

      const activeStream = activeStreamRef.current;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
        activeStreamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setStream(null);
        setCameraLoading(false);
        setCameraError("Апп background болсон тул камер аюулгүй байдлаар зогслоо. Буцаж ирээд «Камер асаах» товчийг дахин дарна уу.");
      }

      sceneAbortRef.current?.abort();
      sceneAbortRef.current = null;
      setIsAnalyzingScene(false);
      setVoiceGuidanceEnabled(false);
      lastAnnouncedInstructionRef.current = "";
      stopSpeech();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [stopSpeech]);

  // GPS and the camera feed remain device-local, but scene recognition and server TTS need a network.
  useEffect(() => {
    const handleOffline = () => {
      sceneAbortRef.current?.abort();
      sceneAbortRef.current = null;
      setIsAnalyzingScene(false);
      setSceneError(OFFLINE_SCENE_ERROR);
      setVoiceGuidanceEnabled(false);
      lastAnnouncedInstructionRef.current = "";
      stopSpeech();
      setSpeechStatus("error");
      setSpeechError(OFFLINE_SPEECH_ERROR);
    };

    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, [stopSpeech]);

  // The offline pill already covers both offline notices, and they clear once the network returns.
  const visibleSceneError = sceneError === OFFLINE_SCENE_ERROR ? "" : sceneError;
  const visibleSpeechError = speechError === OFFLINE_SPEECH_ERROR ? "" : speechError;

  const toggleVoiceGuidance = useCallback(() => {
    if (voiceGuidanceEnabled) {
      setVoiceGuidanceEnabled(false);
      lastAnnouncedInstructionRef.current = "";
      stopSpeech();
      setSpeechError("");
      return;
    }

    setVoiceGuidanceEnabled(true);
    const currentInstruction = instruction.replace(/\s+/g, " ").trim();
    lastAnnouncedInstructionRef.current = currentInstruction;
    void playSpeech(currentInstruction || "Дуугаар чиглүүлэлт идэвхжлээ. GPS маршрутаа шалгаж байна.");
  }, [instruction, playSpeech, stopSpeech, voiceGuidanceEnabled]);

  const stopCamera = useCallback(() => {
    sceneAbortRef.current?.abort();
    sceneAbortRef.current = null;
    setIsAnalyzingScene(false);
    const activeStream = activeStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setCameraLoading(false);
    setCompassEnabled(false);
    setCompassNote("Утсаа хөдөлгөж луужинг тохируулна уу.");
    setCameraError("");
    setSceneError("");
    setSceneDescription("");
    setIsAnalyzingScene(false);
    setVoiceGuidanceEnabled(false);
    lastAnnouncedInstructionRef.current = "";
    stopSpeech();
  }, [stopSpeech]);

  const startCamera = useCallback(async () => {
    if (cameraRequestInFlightRef.current || activeStreamRef.current) return;

    setCameraError("");
    setCameraLoading(true);
    cameraRequestInFlightRef.current = true;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Камер ашиглах боломжгүй байна. HTTPS хаяг эсвэл шинэчилсэн browser ашиглана уу. Android дээр SafePath-ийн HTTPS хаягаар нээнэ үү.");
      setCameraLoading(false);
      cameraRequestInFlightRef.current = false;
      return;
    }

    let nextStream: MediaStream | null = null;
    try {
      // Prefer the rear-facing camera. A simpler fallback helps devices whose WebView
      // does not support the full constraint set.
      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (firstError) {
        const firstName = firstError instanceof Error ? firstError.name : "";
        if (firstName === "NotAllowedError" || firstName === "SecurityError") throw firstError;
        nextStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }

      if (!nextStream) {
        throw new Error("Camera stream was not created.");
      }
      activeStreamRef.current = nextStream;
      setStream(nextStream);

      // Compass permission is separate from camera permission on some browsers (notably iOS).
      // The camera should remain usable even if the compass is unavailable or denied.
      if (typeof DeviceOrientationEvent !== "undefined") {
        const orientationApi = DeviceOrientationEvent as DeviceOrientationPermissionApi;
        if (typeof orientationApi.requestPermission === "function") {
          try {
            const permission = await orientationApi.requestPermission();
            setCompassEnabled(permission === "granted");
            if (permission !== "granted") {
              setCompassNote("Луужингийн зөвшөөрөл өгөөгүй тул сумны чиглэл утасны луужинтай таарахгүй байж болно.");
            }
          } catch {
            setCompassEnabled(false);
            setCompassNote("Луужингийн мэдрэгчийг нээж чадсангүй. Камер ажилласаар байна.");
          }
        } else {
          setCompassEnabled(true);
        }
      } else {
        setCompassEnabled(false);
        setCompassNote("Энэ төхөөрөмж луужингийн мэдрэгч дэмжихгүй байна. Газрын зургийн маршрутыг дагаарай.");
      }
    } catch (error) {
      if (nextStream) nextStream.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
      setStream(null);
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraError("Камерын зөвшөөрөл хаалттай байна. Android Settings эсвэл browser-ийн Site Settings дээр SafePath-ийн Camera зөвшөөрлийг Allow болгоорой.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
        setCameraError("Камер олдсонгүй. Төхөөрөмжийн камер байгаа эсэхийг шалгана уу.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setCameraError("Камерыг өөр апп ашиглаж байж магадгүй. Бусад камерын аппыг хаагаад дахин оролдоно уу.");
      } else {
        setCameraError("Камер нээгдсэнгүй. Зөвшөөрөл, HTTPS холболт болон төхөөрөмжийн камерыг шалгаад дахин оролдоно уу.");
      }
      setCompassEnabled(false);
    } finally {
      setCameraLoading(false);
      cameraRequestInFlightRef.current = false;
    }
  }, []);

  const analyzeScene = useCallback(async () => {
    if (!isOnline) {
      setSceneError("Интернет холболтгүй байна. Сүлжээнд холбогдсоны дараа дахин оролдоно уу.");
      return;
    }
    const video = videoRef.current;
    if (!stream || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth < 1) {
      setSceneError("Эхлээд камераа асаагаад дүрс гарч ирэхийг хүлээнэ үү.");
      return;
    }
    if (isAnalyzingScene) return;

    setIsAnalyzingScene(true);
    setSceneError("");
    setSceneDescription("");
    const controller = new AbortController();
    sceneAbortRef.current?.abort();
    sceneAbortRef.current = controller;

    try {
      // Downscale the still frame before upload to reduce mobile data and request size.
      const maxDimension = 768;
      const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Зургийг боловсруулах боломжгүй байна.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const image = await new Promise<string>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Камерын зураг бэлдэж чадсангүй."));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Камерын зургийг уншиж чадсангүй."));
          };
          reader.onerror = () => reject(new Error("Камерын зургийг уншиж чадсангүй."));
          reader.readAsDataURL(blob);
        }, "image/jpeg", 0.72);
      });

      const response = await fetch("/api/vision/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          instruction: instruction.slice(0, 160),
          routeContext: {
            instruction: instruction.slice(0, 160),
            destinationName: destinationName.slice(0, 80),
            remainingDistanceMeters: Number.isFinite(remainingDistance) ? remainingDistance : null,
            targetBearingDegrees: targetBearing,
            deviceHeadingDegrees: heading,
            relativeBearingDegrees: relativeBearing,
            routeReady: route.length >= 2,
          },
        }),
        signal: controller.signal,
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "Орчныг таньж чадсангүй. Дахин оролдоно уу.";
        throw new Error(message);
      }
      if (!result || typeof result !== "object" || !("description" in result) || typeof result.description !== "string") {
        throw new Error("AI-аас зөв хариу ирсэнгүй. Дахин оролдоно уу.");
      }
      setSceneDescription(result.description);
      if (voiceGuidanceEnabled) void playSpeech(result.description);
    } catch (error) {
      if (!controller.signal.aborted) {
        setSceneError(error instanceof Error ? error.message : "Орчныг таних үед алдаа гарлаа.");
      }
    } finally {
      if (sceneAbortRef.current === controller) sceneAbortRef.current = null;
      setIsAnalyzingScene(false);
    }
  }, [destinationName, heading, instruction, isAnalyzingScene, isOnline, playSpeech, relativeBearing, remainingDistance, route.length, stream, targetBearing, voiceGuidanceEnabled]);

  const dismissScene = useCallback(() => {
    sceneAbortRef.current?.abort();
    sceneAbortRef.current = null;
    setIsAnalyzingScene(false);
    setSceneDescription("");
    setSceneError("");
  }, []);

  // The parent requests this only after the five-minute Safe Zone exit countdown expires.
  // getUserMedia may still be blocked by the browser if camera permission has not been granted.
  useEffect(() => {
    if (!autoStart) return;
    onAutoStartAttempted?.();
    // Defer so the camera's loading state is set outside the effect body.
    queueMicrotask(() => void startCamera());
  }, [autoStart, onAutoStartAttempted, startCamera]);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 isolate overflow-hidden bg-[#071116] text-white"
      style={AR_LAYOUT_VARIABLES}
      aria-label="Камераар бодит орчин дээр маршрут чиглүүлэх"
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 size-full object-cover"
          aria-label="Утасны арын камерын дүрс"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,116,144,.3),transparent_58%),linear-gradient(160deg,#1b3037,#050a0e)]" />
      )}

      {/* Darken only the top edge so the banner reads well without dimming the street. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-black/45 to-transparent" />

      {/* Facing away, a path "ahead" would mislead; the amber banner says to turn around instead. */}
      {stream && route.length >= 2 && !isNearDestination && !isFacingAway && (
        <GroundPath bend={pathBend} muted={relativeBearing === null} scale={groundScale} />
      )}

      {/* Destination sign on a short post, standing in the street toward the destination. */}
      {stream && (
        <div
          className="pointer-events-none absolute z-20 flex -translate-x-1/2 flex-col items-center transition-[left] duration-300 ease-out"
          style={{
            top: "max(8rem, calc(var(--ar-horizon) - 7rem))",
            left: `calc(50% + ${signShift.toFixed(3)} * (50% - 6.5rem))`,
          }}
        >
          <div className={`flex max-w-52 items-center gap-2 rounded-2xl px-3 py-2 shadow-[0_12px_28px_rgba(0,32,96,.35)] ring-1 ring-white/30 transition-colors ${isNearDestination ? "bg-emerald-600" : "bg-[#2a7fff]"}`}>
            {signEdge === "left" && <ChevronLeft size={20} strokeWidth={3} className="-ml-1 shrink-0" aria-hidden="true" />}
            {isNearDestination ? <Flag size={24} fill="currentColor" className="shrink-0" aria-hidden="true" /> : <PinMark />}
            <div className="min-w-0">
              <p className="text-[21px] font-extrabold leading-6 tracking-tight">{formatDistance(remainingDistance) || "—"}</p>
              <p className="truncate text-[13px] font-semibold leading-[18px] text-white/95">{destinationName}</p>
            </div>
            {signEdge === "right" && <ChevronRight size={20} strokeWidth={3} className="-mr-1 shrink-0" aria-hidden="true" />}
          </div>
          <div className="h-5 w-[3px] rounded-b-full bg-linear-to-b from-white to-white/40" />
          <div className="-mt-0.5 h-1.5 w-6 rounded-[50%] bg-black/35 blur-[2px]" />
        </div>
      )}

      {!stream && (
        <div
          className="pointer-events-none absolute inset-x-5 z-20 flex items-center justify-center overflow-y-auto"
          style={{ top: "6.5rem", bottom: "calc(var(--ar-dome) * 0.8 + 3.5rem)" }}
        >
          <div className="pointer-events-auto w-full max-w-[18rem] rounded-3xl bg-[#0b1620]/85 p-4 text-center shadow-xl ring-1 ring-white/10 backdrop-blur-md">
            <p className="text-[16px] font-semibold leading-6">Камераа асаагаад газар дээрх цэнхэр сумыг дагаарай.</p>
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={cameraLoading}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2a7fff] px-4 text-[16px] font-bold text-white shadow-[0_8px_20px_rgba(42,127,255,.35)] transition hover:bg-[#1c6fee] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              {cameraLoading ? <SafePathLoading variant="button" /> : <Camera size={18} aria-hidden="true" />}
              {cameraLoading ? "Нээж байна…" : "Камер асаах"}
            </button>
            {cameraError && <p role="alert" className="mt-3 text-left text-[14px] leading-5 text-rose-200">{cameraError}</p>}
          </div>
        </div>
      )}

      {/* Top stack: a single instruction banner, then any notices, in normal flow so nothing overlaps. */}
      <div
        className="pointer-events-none absolute inset-x-3 top-3 z-40 flex flex-col gap-2 overflow-y-auto overscroll-contain [scrollbar-width:none]"
        style={{ maxHeight: "calc(100% - var(--ar-dome) - 1.5rem)" }}
      >
        <div className="pointer-events-auto flex shrink-0 items-start gap-2">
          <div role="status" aria-live="polite" className={`flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-[20px] px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,.3)] ring-1 backdrop-blur-md transition-colors ${bannerTone}`}>
            <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${isNearDestination || isFacingAway ? "bg-white/20" : "bg-[#2a7fff]"}`} aria-hidden="true">
              {isNearDestination ? (
                <Flag size={22} fill="currentColor" />
              ) : relativeBearing !== null ? (
                <Navigation2 size={24} fill="currentColor" style={{ transform: `rotate(${Math.round(relativeBearing)}deg)` }} />
              ) : route.length < 2 ? (
                <SafePathLoading variant="button" />
              ) : (
                <Compass size={22} />
              )}
            </span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-[17px] font-bold leading-[22px]">{bannerTitle}</p>
              {bannerDetail && <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-[18px] text-white/80">{bannerDetail}</p>}
            </div>
          </div>
          {stream && (
            <button
              type="button"
              onClick={stopCamera}
              className="grid size-12 shrink-0 place-items-center rounded-full bg-[#0b1620]/80 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md transition hover:bg-[#16293a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              aria-label="Камерыг унтраах"
            >
              <CameraOff size={20} />
            </button>
          )}
        </div>

        {!isOnline && (
          <p className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 self-center rounded-full bg-amber-400/95 px-3 py-1.5 text-[13px] font-bold text-amber-950 shadow-lg">
            <WifiOff size={14} aria-hidden="true" /> Интернетгүй · AI болон дуу түр зогссон
          </p>
        )}

        {stream && cameraError && (
          <p role="alert" className="pointer-events-auto shrink-0 rounded-2xl bg-rose-950/95 px-4 py-3 text-[15px] leading-6 text-rose-50 shadow-lg ring-1 ring-rose-200/30">
            {cameraError}
          </p>
        )}

        {visibleSpeechError && (
          <p role="alert" className="pointer-events-auto shrink-0 rounded-2xl bg-[#0b1620]/90 px-4 py-3 text-[15px] leading-6 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md">
            {visibleSpeechError}
          </p>
        )}

        {(sceneDescription || visibleSceneError) && (
          <div className="pointer-events-auto shrink-0 rounded-2xl bg-[#0b1620]/90 px-4 py-3.5 shadow-xl ring-1 ring-cyan-100/20 backdrop-blur-md" aria-live="polite">
            <div className="flex items-center gap-2 text-[15px] font-bold text-cyan-100">
              <Sparkles size={15} aria-hidden="true" /> AI орчны тайлбар
              <button
                type="button"
                onClick={dismissScene}
                className="-my-2 -mr-2 ml-auto grid size-11 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                aria-label="AI орчны тайлбарыг хаах"
              >
                <X size={18} />
              </button>
            </div>
            {sceneDescription && <p className="mt-1 text-[16px] leading-6 text-white">{sceneDescription}</p>}
            {visibleSceneError && <p role="alert" className="mt-1 text-[15px] leading-5 text-rose-100">{visibleSceneError}</p>}
            <p className="mt-2 text-[12px] leading-4 text-white/65">GPS заавар үндсэн хэвээр. AI зам хөндлөн гарах аюулгүй эсэхийг баталгаажуулахгүй.</p>
          </div>
        )}
      </div>

      {/* Two quick actions resting on the dome's rim in the lower corners, clear of the path and the sign. */}
      <div
        className="pointer-events-none absolute inset-x-3 z-30 flex items-end justify-between"
        style={{ bottom: "calc(var(--ar-dome) * 0.8)" }}
      >
        <ArControl
          label="Дуу"
          active={voiceGuidanceEnabled}
          disabled={!isOnline && !voiceGuidanceEnabled}
          onClick={toggleVoiceGuidance}
          ariaPressed={voiceGuidanceEnabled}
        >
          {speechStatus === "loading"
            ? <SafePathLoading variant="button" />
            : voiceGuidanceEnabled
              ? <Volume2 size={18} className={speechStatus === "playing" ? "animate-pulse" : ""} aria-hidden="true" />
              : <VolumeX size={18} aria-hidden="true" />}
        </ArControl>
        {stream && (
          <ArControl
            label={isAnalyzingScene ? "Таньж байна…" : "AI тайлбар"}
            disabled={isAnalyzingScene || !isOnline}
            onClick={() => void analyzeScene()}
          >
            {isAnalyzingScene ? <SafePathLoading variant="button" /> : <ScanEye size={18} aria-hidden="true" />}
          </ArControl>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {speechStatus === "loading" ? "Монгол хэлний дууны заавар бэлдэж байна" : speechStatus === "playing" ? "GPS зааврыг дуугаар уншиж байна" : ""}
      </p>

      {/* Curved mini-map. The dome is wider than the screen so only its gentle top arc shows. */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-(--ar-dome)">
        <div
          className="absolute inset-y-0 -left-[18%] -right-[18%] isolate overflow-hidden border-4 border-b-0 border-white bg-[#eef1f4] shadow-[0_-10px_30px_rgba(0,0,0,.3)]"
          style={{ borderRadius: "50% 50% 0 0 / 100% 100% 0 0" }}
        >
          {/* Inset back to the visible width so the map centres on the person, not on the off-screen dome. */}
          <div className="absolute inset-y-0 left-[13.2353%] right-[13.2353%]">
            {/* Seen from a slant and turned with the compass, so it matches the camera view above it. */}
            <TiltedPlane tilt={45} centerPercent={50} heading={heading} fadeColor="#eef1f4">
              <CameraMiniMap
                location={miniMapLocation}
                currentRoute={route}
                destination={routeDestination ?? undefined}
                variant="companion"
                routeColor="#2a7fff"
                showCredit={false}
                className="ar-minimap h-full w-full rounded-none border-0"
              />
            </TiltedPlane>
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[403] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
              {heading === null ? (
                <span className="block size-4 rounded-full border-[3px] border-white bg-[#2a7fff] shadow-[0_0_0_6px_rgba(42,127,255,.22)]" />
              ) : (
                // The map turns with the compass, so the person always faces straight up.
                <HeadingArrow />
              )}
            </div>
          </div>
        </div>
      </div>

      <audio
        ref={speechAudioRef}
        className="sr-only"
        preload="none"
        onPlaying={() => setSpeechStatus("playing")}
        onEnded={() => {
          setSpeechStatus("idle");
          if (speechObjectUrlRef.current) {
            URL.revokeObjectURL(speechObjectUrlRef.current);
            speechObjectUrlRef.current = null;
          }
        }}
        onError={() => {
          setSpeechStatus("error");
          setSpeechError("Дууг тоглуулж чадсангүй. Дахин оролдоно уу.");
        }}
      />

    </div>
  );
}
