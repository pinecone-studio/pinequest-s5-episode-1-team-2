"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useCompassHeading } from "@/hooks/use-compass-heading";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { Camera, CameraOff, MapPin, ChevronLeft, ChevronRight, Compass, Flag, Navigation2, ScanEye, Sparkles, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { SafePathLoading } from "@/components/safepath-loading";
import { HeadingArrow, TiltedPlane } from "@/components/tilted-plane";
import { SCENE_LANDMARK_ICONS, type SceneLandmark, type SceneLandmarkSide } from "@/types/vision";
import { bearingDegrees, distanceMeters, pickLookAheadPoint, relativeBearing as turnFrom, type Coordinate, type RoutePoint } from "@/lib/route-guidance";

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

// Rough half-width of a phone's rear camera view in portrait; used to place the destination sign.
const CAMERA_HALF_FOV_DEGREES = 28;

// Distance of each chevron group along the virtual ground plane (px), nearest first.
const CHEVRON_DISTANCES = [0, 290, 560];
const CHEVRON_WIDTH = 160;
// Chevrons are drawn longer than wide so they still read clearly once the ground plane squashes them.
const CHEVRON_STRETCH = 1.6;
const CHEVRON_LENGTH = CHEVRON_WIDTH * CHEVRON_STRETCH;

// How far the child must walk before their direction of travel turns the mini-map.
const MOVEMENT_HEADING_MIN_METERS = 10;

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




function formatDistance(distance: number | null): string {
  if (distance === null || !Number.isFinite(distance)) return "";
  if (distance < 1000) return `${Math.max(0, Math.round(distance))} м`;
  return `${(distance / 1000).toFixed(1)} км`;
}

const SCENE_REQUEST_TIMEOUT_MS = 22_000;

// Auto-scan: first look shortly after the camera opens, then again only after the child has
// walked on, which keeps AI requests to a couple per minute at most.
const AUTO_SCAN_FIRST_DELAY_MS = 6_000;
const AUTO_SCAN_CHECK_MS = 5_000;
const AUTO_SCAN_INTERVAL_MS = 25_000;
const AUTO_SCAN_MIN_MOVE_METERS = 40;
const SHARED_NOTICE_MS = 5_000;
// The surroundings photo sent to guardians when the camera opens: small, and after exposure settles.
const SCENE_PHOTO_MAX_PX = 640;
const SCENE_PHOTO_DELAY_MS = 1_500;
const SCENE_PHOTO_RETRY_MS = 500;
const SCENE_PHOTO_MAX_TRIES = 20;

type SceneResult = {
  description: string;
  landmarks: SceneLandmark[];
  snapshot: SceneSnapshot;
  capturedAt: { latitude: number; longitude: number; heading: number | null };
};
// Half of a landmark tag's widest size (max-w-52) plus a small gutter, so tags never touch the screen edge.
const TAG_HALF_WIDTH = 112;

type SceneSnapshot = {
  url: string;
  width: number;
  height: number;
};

// High-contrast colours shared by each landmark's outline, number badge and list row.
const LANDMARK_COLORS = ["#facc15", "#f472b6", "#4ade80", "#fb923c"];

const LANDMARK_ICONS = SCENE_LANDMARK_ICONS;

const LANDMARK_SIDE_TEXT: Record<SceneLandmarkSide, string> = {
  left: "Зүүн талд",
  center: "Яг урд чинь",
  right: "Баруун талд",
};

function readSceneLandmarks(value: unknown): SceneLandmark[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is SceneLandmark =>
    Boolean(entry)
    && typeof entry === "object"
    && typeof entry.label === "string"
    && typeof entry.detail === "string"
    && entry.kind in LANDMARK_ICONS
    && entry.side in LANDMARK_SIDE_TEXT
    && typeof entry.notable === "boolean"
    && (entry.box === null || (Array.isArray(entry.box) && entry.box.length === 4 && entry.box.every((n: unknown) => typeof n === "number"))),
  ).slice(0, LANDMARK_COLORS.length);
}

// Read the summary first, then each numbered landmark, so the voice matches the badges on screen.
function spokenSceneText(summary: string, landmarks: SceneLandmark[]): string {
  const items = landmarks.map((landmark, index) => `${index + 1}. ${LANDMARK_SIDE_TEXT[landmark.side]} ${landmark.label}.`);
  return [summary, ...items].join(" ");
}

// Numbered outlines and name tags drawn over the frozen frame. The frame is shown with
// object-cover, so the model's 0–1000 boxes are mapped through the same crop.
function LandmarkMarkers({ landmarks, snapshot, width, height }: {
  landmarks: SceneLandmark[];
  snapshot: SceneSnapshot;
  width: number;
  height: number;
}) {
  if (!width || !height) return null;
  const scale = Math.max(width / snapshot.width, height / snapshot.height);
  const offsetX = (width - snapshot.width * scale) / 2;
  const offsetY = (height - snapshot.height * scale) / 2;
  const toX = (value: number) => Math.min(width, Math.max(0, (value / 1000) * snapshot.width * scale + offsetX));
  const toY = (value: number) => Math.min(height, Math.max(0, (value / 1000) * snapshot.height * scale + offsetY));
  const sideX = { left: 0.22, center: 0.5, right: 0.78 };

  // Keep tags below the banner and above the bottom list, and nudge overlapping tags apart.
  const tagTop = height * 0.18;
  const tagBottom = height * 0.5;
  const placed: { x: number; y: number }[] = [];
  const markers = landmarks.map((landmark, index) => {
    const rect = landmark.box
      ? { left: toX(landmark.box[1]), top: toY(landmark.box[0]), right: toX(landmark.box[3]), bottom: toY(landmark.box[2]) }
      : null;
    const visibleRect = rect && rect.right - rect.left > 12 && rect.bottom - rect.top > 12 ? rect : null;
    let x = visibleRect ? (visibleRect.left + visibleRect.right) / 2 : width * sideX[landmark.side];
    let y = visibleRect ? visibleRect.top + Math.min(48, (visibleRect.bottom - visibleRect.top) / 3) : height * 0.42;
    x = Math.min(width - TAG_HALF_WIDTH, Math.max(TAG_HALF_WIDTH, x));
    y = Math.min(tagBottom, Math.max(tagTop, y));
    while (placed.some((other) => Math.abs(other.x - x) < TAG_HALF_WIDTH * 2 && Math.abs(other.y - y) < 64)) y += 66;
    placed.push({ x, y });
    return { landmark, index, rect: visibleRect, x, y };
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {markers.map(({ index, rect }) => rect && (
        <div
          key={`box-${index}`}
          className="absolute rounded-xl border-[3px] shadow-[0_0_0_2px_rgba(0,0,0,.35)]"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.right - rect.left,
            height: rect.bottom - rect.top,
            borderColor: LANDMARK_COLORS[index],
          }}
        />
      ))}
      {markers.map(({ landmark, index, x, y }) => (
        <div
          key={`tag-${index}`}
          className="absolute flex w-max max-w-52 -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-[20px] bg-white py-1 pl-1 pr-3 text-[#0b1620] shadow-[0_6px_18px_rgba(0,0,0,.45)]"
          style={{ left: x, top: y }}
        >
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full text-[17px] font-black text-black"
            style={{ backgroundColor: LANDMARK_COLORS[index] }}
          >
            {index + 1}
          </span>
          <span className="text-[18px] leading-none">{LANDMARK_ICONS[landmark.kind]}</span>
          <span className="line-clamp-2 text-[16px] font-extrabold leading-5">{landmark.label}</span>
        </div>
      ))}
    </div>
  );
}

const OFFLINE_SCENE_ERROR ="Интернет тасарсан тул AI орчны танилт түр зогслоо. Сүлжээ сэргэсний дараа дахин оролдоно уу.";
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
  // Without a compass, the direction the child is walking still tells which way is "ahead".
  // Updated only after a real step forward, so GPS jitter while standing does not spin the map.
  const [movement, setMovement] = useState<{ anchor: Coordinate; bearing: number | null }>({ anchor: location, bearing: null });
  if (distanceMeters(movement.anchor, location) >= MOVEMENT_HEADING_MIN_METERS) {
    setMovement({ anchor: location, bearing: bearingDegrees(movement.anchor, location) });
  }
  const mapHeading = heading ?? movement.bearing;
  // The arrows use the same fallback: without a compass, "ahead" is the way the child is walking.
  const guideHeading = mapHeading;
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
  const [rootWidth, setRootWidth] = useState(0);
  const [sceneLandmarks, setSceneLandmarks] = useState<SceneLandmark[]>([]);
  // The frame the AI looked at; frozen on screen so landmark labels stay on their buildings.
  const [sceneSnapshot, setSceneSnapshot] = useState<SceneSnapshot | null>(null);
  // Names of the places just sent to the guardians' map, shown briefly to the child.
  const [sharedNotice, setSharedNotice] = useState("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      setRootHeight(entry.contentRect.height);
      setRootWidth(entry.contentRect.width);
    });
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
    targetBearing !== null && guideHeading !== null
      ? turnFrom(targetBearing, guideHeading)
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
  const destinationRelative = routeDestination && guideHeading !== null
    ? turnFrom(bearingDegrees(location, routeDestination), guideHeading)
    : null;
  const signShift = destinationRelative === null
    ? 0
    : Math.max(-1, Math.min(1, destinationRelative / CAMERA_HALF_FOV_DEGREES));
  const signEdge = destinationRelative === null || Math.abs(destinationRelative) <= CAMERA_HALF_FOV_DEGREES
    ? null
    : destinationRelative > 0 ? "right" : "left";
  const isNearDestination = remainingDistance !== null && remainingDistance < 15;
  const showingSnapshot = stream !== null && sceneSnapshot !== null;
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
      : guideHeading !== null
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
    setSceneLandmarks([]);
    setSceneSnapshot(null);
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

    // iOS only grants motion access while the tap is still active, so ask now, before awaiting the camera.
    const orientationApi = typeof DeviceOrientationEvent !== "undefined"
      ? DeviceOrientationEvent as DeviceOrientationPermissionApi
      : null;
    const compassPermission = typeof orientationApi?.requestPermission === "function"
      ? orientationApi.requestPermission().catch(() => "error" as const)
      : null;

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
      if (orientationApi) {
        if (compassPermission) {
          const permission = await compassPermission;
          setCompassEnabled(permission === "granted");
          if (permission === "denied") {
            setCompassNote("Луужингийн зөвшөөрөл өгөөгүй тул газрын зураг алхаж буй чиглэлээр эргэнэ.");
          } else if (permission === "error") {
            setCompassNote("Луужингийн мэдрэгчийг нээж чадсангүй. Газрын зураг алхаж буй чиглэлээр эргэнэ.");
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

  // Captures the current frame and asks the AI what is in it. Shared by the button and the auto-scan.
  const requestScene = useCallback(async (signal: AbortSignal): Promise<SceneResult> => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth < 1) {
      throw new Error("Эхлээд камераа асаагаад дүрс гарч ирэхийг хүлээнэ үү.");
    }
    const capturedAt = { latitude: location.latitude, longitude: location.longitude, heading };

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
      // The server gives up within ~18 s; never leave the button spinning longer than this.
      signal: AbortSignal.any([signal, AbortSignal.timeout(SCENE_REQUEST_TIMEOUT_MS)]),
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
    return {
      description: result.description,
      landmarks: "landmarks" in result ? readSceneLandmarks(result.landmarks) : [],
      snapshot: { url: image, width: canvas.width, height: canvas.height },
      capturedAt,
    };
  }, [destinationName, heading, instruction, location.latitude, location.longitude, relativeBearing, remainingDistance, route.length, targetBearing]);

  // Sends the places that stand out to the guardians' map. Best effort: navigation never waits on it.
  const shareNotableLandmarks = useCallback(async ({ landmarks, capturedAt }: SceneResult) => {
    const notable = landmarks.filter((landmark) => landmark.notable).slice(0, 2);
    if (!notable.length) return;
    try {
      const response = await fetch("/api/landmarks/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: capturedAt.latitude,
          longitude: capturedAt.longitude,
          heading: capturedAt.heading,
          landmarks: notable.map(({ label, detail, kind, box }) => ({ label, detail, kind, box })),
        }),
      });
      if (!response.ok) return;
      const result: unknown = await response.json().catch(() => null);
      if (result && typeof result === "object" && "saved" in result && typeof result.saved === "number" && result.saved > 0) {
        setSharedNotice(`Эцэг эхийн газрын зурагт нэмэгдлээ: ${notable.map((landmark) => landmark.label).join(", ")}`);
      }
    } catch {
      // A missed share only means one fewer pin on the guardian's map.
    }
  }, []);

  const analyzeScene = useCallback(async () => {
    if (!isOnline) {
      setSceneError("Интернет холболтгүй байна. Сүлжээнд холбогдсоны дараа дахин оролдоно уу.");
      return;
    }
    if (!stream) {
      setSceneError("Эхлээд камераа асаагаад дүрс гарч ирэхийг хүлээнэ үү.");
      return;
    }
    if (isAnalyzingScene) return;

    setIsAnalyzingScene(true);
    setSceneError("");
    setSceneDescription("");
    setSceneLandmarks([]);
    setSceneSnapshot(null);
    const controller = new AbortController();
    sceneAbortRef.current?.abort();
    sceneAbortRef.current = controller;

    try {
      const scene = await requestScene(controller.signal);
      setSceneDescription(scene.description);
      setSceneLandmarks(scene.landmarks);
      if (scene.landmarks.length > 0) setSceneSnapshot(scene.snapshot);
      if (voiceGuidanceEnabled) void playSpeech(spokenSceneText(scene.description, scene.landmarks));
      void shareNotableLandmarks(scene);
    } catch (error) {
      if (!controller.signal.aborted) {
        setSceneError(
          error instanceof DOMException && error.name === "TimeoutError"
            ? "AI хариу удаж байна. Түр хүлээгээд дахин оролдоно уу."
            : error instanceof Error ? error.message : "Орчныг таних үед алдаа гарлаа.",
        );
      }
    } finally {
      if (sceneAbortRef.current === controller) sceneAbortRef.current = null;
      setIsAnalyzingScene(false);
    }
  }, [isAnalyzingScene, isOnline, playSpeech, requestScene, shareNotableLandmarks, stream, voiceGuidanceEnabled]);

  // The interval below reads the newest callbacks and position through refs, so it is not restarted on every GPS update.
  const requestSceneRef = useRef(requestScene);
  const shareNotableRef = useRef(shareNotableLandmarks);
  const locationRef = useRef(location);
  useEffect(() => {
    requestSceneRef.current = requestScene;
    shareNotableRef.current = shareNotableLandmarks;
    locationRef.current = location;
  });

  // While the camera is on, quietly look again every so often once the child has walked on,
  // so notable places reach the guardian's map without the child pressing anything.
  useEffect(() => {
    if (!stream || !isOnline) return;
    const controller = new AbortController();
    let busy = false;
    let lastScan: { at: number; position: Coordinate } | null = null;

    const tick = async () => {
      // Skip while hidden, while the child's own "AI тайлбар" request runs, or while one is still going.
      if (busy || document.visibilityState !== "visible" || sceneAbortRef.current) return;
      const here = locationRef.current;
      if (lastScan && (Date.now() - lastScan.at < AUTO_SCAN_INTERVAL_MS || distanceMeters(lastScan.position, here) < AUTO_SCAN_MIN_MOVE_METERS)) return;
      busy = true;
      lastScan = { at: Date.now(), position: here };
      try {
        const scene = await requestSceneRef.current(controller.signal);
        if (!controller.signal.aborted) await shareNotableRef.current(scene);
      } catch {
        // Silent: the auto-scan never shows errors over the child's navigation.
      } finally {
        busy = false;
      }
    };

    const first = window.setTimeout(() => void tick(), AUTO_SCAN_FIRST_DELAY_MS);
    const interval = window.setInterval(() => void tick(), AUTO_SCAN_CHECK_MS);
    return () => {
      controller.abort();
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [isOnline, stream]);

  // When the camera opens, its first clear frame goes to the guardians, so they can see where the
  // child is. Once per opening; the child is told it was sent. The server drops it if sharing is paused.
  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;
    const controller = new AbortController();
    let sent = false;
    let tries = 0;
    let timer: number | undefined;

    const sendFirstFrame = async () => {
      if (sent || controller.signal.aborted) return;
      // Some phones take a few seconds before the first frame exists; keep checking for a while.
      if (video.videoWidth < 1 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        tries += 1;
        if (tries < SCENE_PHOTO_MAX_TRIES) timer = window.setTimeout(() => void sendFirstFrame(), SCENE_PHOTO_RETRY_MS);
        return;
      }
      sent = true;
      const scale = Math.min(1, SCENE_PHOTO_MAX_PX / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const here = locationRef.current;
      try {
        const response = await fetch("/api/scene-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: canvas.toDataURL("image/jpeg", 0.6), latitude: here.latitude, longitude: here.longitude }),
          signal: controller.signal,
        });
        const result: unknown = await response.json().catch(() => null);
        const reason = result && typeof result === "object" && "reason" in result ? result.reason : null;
        if (response.ok && result && typeof result === "object" && "saved" in result && result.saved === true) {
          setSharedNotice("📷 Орчны зураг ээж, аавд илгээгдлээ");
        } else if (reason === "paused") {
          setSharedNotice("📷 Байршил хуваалцах түр зогссон тул зураг илгээгдсэнгүй");
        } else if (reason === "no-guardian") {
          setSharedNotice("📷 Холбогдсон ээж, аав байхгүй тул зураг илгээгдсэнгүй");
        } else if (!controller.signal.aborted) {
          setSharedNotice("📷 Зургийг илгээж чадсангүй");
        }
      } catch {
        // The photo is a help for guardians, never a reason to interrupt the camera.
        if (!controller.signal.aborted) setSharedNotice("📷 Зургийг илгээж чадсангүй");
      }
    };

    // Give the camera a moment to settle its exposure so the first frame is not dark.
    timer = window.setTimeout(() => void sendFirstFrame(), SCENE_PHOTO_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [stream]);

  // A short confirmation so the child knows what was shared, then it fades away.
  useEffect(() => {
    if (!sharedNotice) return;
    const timer = window.setTimeout(() => setSharedNotice(""), SHARED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [sharedNotice]);

  const dismissScene = useCallback(() => {
    sceneAbortRef.current?.abort();
    sceneAbortRef.current = null;
    setIsAnalyzingScene(false);
    setSceneDescription("");
    setSceneLandmarks([]);
    setSceneSnapshot(null);
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

  const sceneCard = (sceneDescription || visibleSceneError) ? (
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
      {sceneDescription && <p className="mt-1 text-[18px] font-semibold leading-7 text-white">{sceneDescription}</p>}
      {sceneLandmarks.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2">
          {sceneLandmarks.map((landmark, index) => (
            <li key={`${index}-${landmark.label}`} className="flex items-start gap-3 rounded-xl bg-white/10 px-3 py-2.5">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full text-[18px] font-black text-black"
                style={{ backgroundColor: LANDMARK_COLORS[index] }}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[17px] font-extrabold leading-6">
                  <span aria-hidden="true">{LANDMARK_ICONS[landmark.kind]} </span>{landmark.label}
                </p>
                <p className="text-[15px] leading-5 text-white/85">
                  <span className="font-bold text-cyan-100">{LANDMARK_SIDE_TEXT[landmark.side]}</span>
                  {landmark.detail && ` · ${landmark.detail}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {showingSnapshot && (
        <button
          type="button"
          onClick={dismissScene}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2a7fff] px-4 text-[16px] font-bold text-white transition hover:bg-[#1c6fee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <Camera size={18} aria-hidden="true" /> Камер руу буцах
        </button>
      )}
      {visibleSceneError && <p role="alert" className="mt-1 text-[15px] leading-5 text-rose-100">{visibleSceneError}</p>}
      <p className="mt-2 text-[12px] leading-4 text-white/65">GPS заавар үндсэн хэвээр. AI зам хөндлөн гарах аюулгүй эсэхийг баталгаажуулахгүй.</p>
    </div>
  ) : null;
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

      {showingSnapshot && (
        // eslint-disable-next-line @next/next/no-img-element -- a local data URL; next/image adds nothing here.
        <img
          src={sceneSnapshot.url}
          alt="AI-д харуулсан камерын зураг"
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {/* Darken only the top edge so the banner reads well without dimming the street. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-black/45 to-transparent" />

      {showingSnapshot && (
        <LandmarkMarkers landmarks={sceneLandmarks} snapshot={sceneSnapshot} width={rootWidth} height={rootHeight} />
      )}

      {/* Facing away, a path "ahead" would mislead; the amber banner says to turn around instead. */}
      {stream && !showingSnapshot && route.length >= 2 && !isNearDestination && !isFacingAway && (
        <GroundPath bend={pathBend} muted={relativeBearing === null} scale={groundScale} />
      )}

      {/* Destination sign on a short post, standing in the street toward the destination. */}
      {stream && !showingSnapshot && (
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

        {sharedNotice && (
          <p role="status" className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 self-center rounded-full bg-emerald-600/95 px-3 py-1.5 text-[13px] font-bold text-white shadow-lg">
            <MapPin size={14} aria-hidden="true" /> {sharedNotice}
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

        {!showingSnapshot && sceneCard}
      </div>

      {/* With the frame frozen, the list sits at the bottom so it never covers the numbered tags. */}
      {showingSnapshot && sceneCard && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-50 flex max-h-[46%] flex-col overflow-y-auto overscroll-contain [scrollbar-width:none]">
          {sceneCard}
        </div>
      )}

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
            <TiltedPlane tilt={45} centerPercent={50} heading={mapHeading} fadeColor="#eef1f4">
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
              {mapHeading === null ? (
                <span className="block size-4 rounded-full border-[3px] border-white bg-[#2a7fff] shadow-[0_0_0_6px_rgba(42,127,255,.22)]" />
              ) : (
                // The map turns with the compass (or walking direction), so the person always faces straight up.
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
