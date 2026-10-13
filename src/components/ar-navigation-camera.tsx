"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { Camera, CameraOff, Compass, MapPin, ScanEye, LoaderCircle, Sparkles, Volume2, VolumeX } from "lucide-react";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type RoutePoint = [number, number];

type SceneRouteContext = {
  instruction: string;
  destinationName: string;
  remainingDistanceMeters: number | null;
  relativeBearingDegrees: number | null;
};

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

type DeviceOrientationWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type DeviceOrientationPermissionApi = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const EARTH_RADIUS_METERS = 6_371_000;

const CameraMiniMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#f4f5f3] px-4 text-center text-[16px] leading-6 text-[#374151]">
      Газрын зураг ачаалж байна…
    </div>
  ),
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

function readOrientation(event: DeviceOrientationWithCompass): number | null {
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)) {
    return (event.webkitCompassHeading + 360) % 360;
  }

  if (typeof event.alpha !== "number" || !Number.isFinite(event.alpha)) return null;

  // Most browsers expose alpha relative to the device's top edge; account for screen rotation.
  const screenAngle = typeof window !== "undefined" ? (window.screen.orientation?.angle ?? 0) : 0;
  return ((360 - event.alpha + screenAngle) % 360 + 360) % 360;
}

function RouteChevron() {
  return (
    <svg viewBox="0 0 220 130" aria-hidden="true" className="block h-auto w-full overflow-visible">
      <g fill="#1478f8" stroke="#0753c7" strokeWidth="2" strokeLinejoin="round">
        <path d="M110 4 210 51 210 71 110 28 10 71 10 51Z" />
        <path d="M110 35 198 76 198 96 110 57 22 96 22 76Z" />
        <path d="M110 66 186 101 186 121 110 88 34 121 34 101Z" />
      </g>
      <g fill="#ffffff" stroke="#e9f6ff" strokeWidth="1" strokeLinejoin="round">
        <path d="M110 12 190 50 190 55 110 21 30 55 30 50Z" />
        <path d="M110 43 178 75 178 80 110 51 42 80 42 75Z" />
        <path d="M110 74 166 100 166 105 110 82 54 105 54 100Z" />
      </g>
    </svg>
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
  const [heading, setHeading] = useState<number | null>(null);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [compassNote, setCompassNote] = useState("Утсаа хөдөлгөж луужинг тохируулна уу.");
  const [isAnalyzingScene, setIsAnalyzingScene] = useState(false);
  const [sceneDescription, setSceneDescription] = useState("");
  const [sceneRouteContext, setSceneRouteContext] = useState<SceneRouteContext | null>(null);
  const [sceneError, setSceneError] = useState("");
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [speechError, setSpeechError] = useState("");
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const speechSequenceRef = useRef(0);
  const speechObjectUrlRef = useRef<string | null>(null);
  const lastAnnouncedInstructionRef = useRef("");

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

  useEffect(() => {
    if (!compassEnabled) return;

    const handleOrientation = (rawEvent: Event) => {
      const event = rawEvent as DeviceOrientationWithCompass;
      const nextHeading = readOrientation(event);
      if (nextHeading === null) {
        setCompassNote("Луужинг уншиж чадсангүй. Утсаа хөдөлгөж үзнэ үү.");
        return;
      }
      setHeading(nextHeading);
      setCompassNote("");
    };

    window.addEventListener("deviceorientationabsolute", handleOrientation);
    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [compassEnabled]);

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
      lastUpdated: Date.now(),
    }),
    [location.latitude, location.longitude],
  );
  const turnRotation = relativeBearing === null
    ? 0
    : Math.max(-55, Math.min(55, relativeBearing));
  const arrowShift = relativeBearing === null
    ? 0
    : Math.max(-34, Math.min(34, relativeBearing * 0.58));

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
      setSpeechError("Интернет холболтгүй байна. Дууны заавар авахын тулд сүлжээгээ сэргээнэ үү.");
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
    if (isOnline) {
      setSceneError((current) => current === "Интернет тасарсан тул AI орчны танилт түр зогслоо. Сүлжээ сэргэсний дараа дахин оролдоно уу." ? "" : current);
      setSpeechError((current) => current === "Интернет холболтгүй байна. Дууны заавар авахын тулд сүлжээгээ сэргээнэ үү." ? "" : current);
      setSpeechStatus((current) => current === "error" && !speechAbortRef.current ? "idle" : current);
      return;
    }

    sceneAbortRef.current?.abort();
    sceneAbortRef.current = null;
    setIsAnalyzingScene(false);
    setSceneError("Интернет тасарсан тул AI орчны танилт түр зогслоо. Сүлжээ сэргэсний дараа дахин оролдоно уу.");
    setVoiceGuidanceEnabled(false);
    stopSpeech();
    setSpeechStatus("error");
    setSpeechError("Интернет холболтгүй байна. Дууны заавар авахын тулд сүлжээгээ сэргээнэ үү.");
  }, [isOnline, stopSpeech]);

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
    setHeading(null);
    setCompassNote("Утсаа хөдөлгөж луужинг тохируулна уу.");
    setCameraError("");
    setSceneError("");
    setSceneDescription("");
    setSceneRouteContext(null);
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
    setSceneRouteContext(null);
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
      if (
        "routeContext" in result &&
        result.routeContext &&
        typeof result.routeContext === "object" &&
        "instruction" in result.routeContext &&
        typeof result.routeContext.instruction === "string" &&
        "destinationName" in result.routeContext &&
        typeof result.routeContext.destinationName === "string"
      ) {
        const routeContext = result.routeContext as Record<string, unknown>;
        setSceneRouteContext({
          instruction: typeof routeContext.instruction === "string"
            ? routeContext.instruction.slice(0, 160)
            : instruction.slice(0, 160),
          destinationName: typeof routeContext.destinationName === "string"
            ? routeContext.destinationName.slice(0, 80)
            : destinationName.slice(0, 80),
          remainingDistanceMeters: typeof routeContext.remainingDistanceMeters === "number" && Number.isFinite(routeContext.remainingDistanceMeters)
            ? routeContext.remainingDistanceMeters
            : null,
          relativeBearingDegrees: typeof routeContext.relativeBearingDegrees === "number" && Number.isFinite(routeContext.relativeBearingDegrees)
            ? routeContext.relativeBearingDegrees
            : null,
        });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setSceneError(error instanceof Error ? error.message : "Орчныг таних үед алдаа гарлаа.");
      }
    } finally {
      if (sceneAbortRef.current === controller) sceneAbortRef.current = null;
      setIsAnalyzingScene(false);
    }
  }, [destinationName, heading, instruction, isAnalyzingScene, isOnline, relativeBearing, remainingDistance, route.length, stream, targetBearing]);

  // The parent requests this only after the five-minute Safe Zone exit countdown expires.
  // getUserMedia may still be blocked by the browser if camera permission has not been granted.
  useEffect(() => {
    if (!autoStart) return;
    onAutoStartAttempted?.();
    void startCamera();
  }, [autoStart, onAutoStartAttempted, startCamera]);

  return (
    <div className="absolute inset-0 isolate overflow-hidden bg-[#071116] text-white" aria-label="Камераар бодит орчин дээр маршрут чиглүүлэх">
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,116,144,.3),transparent_58%),linear-gradient(160deg,#1b3037,#050a0e)]">
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex max-w-[250px] flex-col items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-center text-[16px] leading-6 text-[#f3f7f7] backdrop-blur-sm">
              <Camera size={36} strokeWidth={1.4} />
              <p className="text-[16px] leading-6">Арын камерыг асаагаад зам дээрх чиглэлийн сумыг хараарай.</p>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/25" />

      {/* Destination distance card, styled like a navigation app's AR banner. */}
      <div className="absolute inset-x-3 top-3 z-30 flex items-start gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] border border-white/15 bg-[#1976f8]/95 px-3 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,.3)] backdrop-blur-md">
          <MapPin size={30} fill="#ff554f" stroke="#ff554f" className="shrink-0 drop-shadow-sm" />
          <div className="min-w-0 text-left">
            <p className="text-[22px] font-bold leading-6 tracking-tight">{formatDistance(remainingDistance) || "—"}</p>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-white/95">{destinationName}</p>
            {!isOnline && <p className="mt-1 text-[10px] font-bold text-amber-100">Интернетгүй · AI/дуу түр зогссон</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => (stream ? stopCamera() : void startCamera())}
          disabled={cameraLoading}
          className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-[16px] border border-white/20 bg-[#071116]/85 px-3 text-[15px] font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-[#122730] disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          aria-label={cameraLoading ? "Камер нээж байна" : stream ? "Камерыг унтраах" : "Арын камерыг асаах"}
        >
          {stream ? <CameraOff size={18} /> : <Camera size={18} />}
          <span>{cameraLoading ? "Нээж байна…" : stream ? "Унтраах" : "Камер асаах"}</span>
        </button>
      </div>

      {cameraError && (
        <p role="alert" className="absolute inset-x-3 top-[82px] z-30 rounded-xl border border-rose-200/30 bg-rose-950/95 px-4 py-3 text-[15px] leading-6 text-rose-50 shadow-lg">
          {cameraError}
        </p>
      )}

      <div className="absolute inset-x-3 top-[126px] z-30 grid grid-cols-2 items-stretch gap-2">
        <button
          type="button"
          onClick={toggleVoiceGuidance}
          disabled={!isOnline && !voiceGuidanceEnabled}
          aria-pressed={voiceGuidanceEnabled}
          className={`inline-flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-[14px] font-bold leading-5 text-center shadow-lg backdrop-blur-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-55 ${voiceGuidanceEnabled ? "border-emerald-200/40 bg-emerald-950/90 text-emerald-50 hover:bg-emerald-900" : "border-white/20 bg-[#071116]/90 text-white hover:bg-[#122730]"}`}
          aria-label={voiceGuidanceEnabled ? "Дуугаар чиглүүлэлтийг унтраах" : "Дуугаар чиглүүлэлтийг асаах"}
        >
          {voiceGuidanceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          <span>{voiceGuidanceEnabled ? "Дуу асаалттай" : "Дуугаар зааварлах"}</span>
        </button>
        <button
          type="button"
          onClick={() => void analyzeScene()}
          disabled={!stream || isAnalyzingScene || !isOnline}
          className="inline-flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-xl border border-cyan-100/30 bg-[#052b35]/90 px-2 py-3 text-[14px] font-bold leading-5 text-center text-cyan-50 shadow-lg backdrop-blur-md transition hover:bg-[#064452] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          aria-label={isAnalyzingScene ? "Орчныг AI-аар таньж байна" : "Камерын дүрсээс орчныг AI-аар таних"}
        >
          {isAnalyzingScene ? <LoaderCircle size={17} className="animate-spin" /> : <ScanEye size={17} />}
          <span>{isAnalyzingScene ? "Таньж байна…" : "Орчныг AI-аар таних"}</span>
        </button>
      </div>

      {(speechStatus === "loading" || speechStatus === "playing" || speechError) && (
        <div className={`absolute inset-x-3 ${speechError || speechStatus !== "idle" ? "top-[222px]" : "top-[174px]"} z-30 mx-auto max-w-lg rounded-xl border border-white/15 bg-[#071820]/95 px-4 py-3 text-[15px] leading-6 text-white shadow-lg backdrop-blur-md`} role={speechError ? "alert" : "status"} aria-live="polite">
          {speechError ? speechError : speechStatus === "loading" ? "Монгол хэлний дууны заавар бэлдэж байна…" : "GPS зааврыг дуугаар уншиж байна…"}
          {speechError && <p className="mt-1 text-white/70">Серверийн ELEVENLABS_API_KEY болон дууны voice ID тохиргоог шалгаарай.</p>}
        </div>
      )}

      {(sceneDescription || sceneError) && (
        <div className={`absolute inset-x-3 ${speechError || speechStatus !== "idle" ? "top-[276px]" : "top-[174px]"} z-30 mx-auto max-w-lg rounded-2xl border border-cyan-100/25 bg-[#071820]/95 px-4 py-4 shadow-xl backdrop-blur-md`} aria-live="polite">
          <div className="mb-2 flex items-center gap-2 text-[15px] font-bold text-cyan-100">
            <Sparkles size={15} /> AI орчны тайлбар
          </div>
          {sceneDescription && <p className="text-[16px] leading-6 text-white">{sceneDescription}</p>}
          {sceneRouteContext && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <p className="text-[13px] font-bold tracking-wide text-cyan-100/90">GPS маршрутын заавар</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-white">{sceneRouteContext.instruction || "GPS заавар хүлээгдэж байна."}</p>
              <p className="mt-1 text-[14px] leading-5 text-white/80">
                {sceneRouteContext.destinationName || destinationName}
                {sceneRouteContext.remainingDistanceMeters !== null
                  ? ` · ${formatDistance(sceneRouteContext.remainingDistanceMeters)} үлдсэн`
                  : " · зай тооцоолж байна"}
              </p>
              {sceneRouteContext.relativeBearingDegrees !== null && (
                <p className="mt-2 text-[14px] text-cyan-100/90">
                  {Math.abs(sceneRouteContext.relativeBearingDegrees) < 18
                    ? "Луужингийн чиглэл: урагш"
                    : sceneRouteContext.relativeBearingDegrees > 0
                      ? "Луужингийн чиглэл: баруун тийш"
                      : "Луужингийн чиглэл: зүүн тийш"}
                </p>
              )}
            </div>
          )}
          {sceneError && <p role="alert" className="text-sm leading-5 text-rose-100">{sceneError}</p>}
          <p className="mt-3 text-[13px] leading-5 text-white/75">AI зурагт харагдаж буй орчныг тайлбарлана. GPS маршрутын заавар үндсэн хэвээр; зураг дангаараа зам хөндлөн гарах аюулгүй байдлыг батлахгүй.</p>
        </div>
      )}

      {/* Floating turn instruction. The arrows below deliberately sit on the camera view, not inside a compass dial. */}
      <div className="absolute inset-x-4 top-[17%] z-20 flex justify-center">
        <div className="max-w-full rounded-full border border-white/25 bg-black/50 px-3 py-1.5 text-center text-[16px] font-bold text-white shadow-lg backdrop-blur-md">
          {relativeBearing === null
            ? (route.length < 2 ? "Зам тооцоолж байна…" : "Луужинг уншиж байна…")
            : Math.abs(relativeBearing) < 18
              ? "Шулуун чигээрээ яваарай"
              : relativeBearing > 0
                ? "Баруун тийш чиглээрэй"
                : "Зүүн тийш чиглээрэй"}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[25%] bottom-[29%] z-10 overflow-hidden" aria-label="Замын чиглэлийн сумнууд">
        <div
          className="absolute left-1/2 top-[1%] w-[19%] min-w-[56px] max-w-[98px] opacity-55"
          style={{ transform: `translateX(calc(-50% + ${arrowShift * 0.35}px)) perspective(650px) rotateX(55deg) rotateZ(${turnRotation * 0.55}deg)`, filter: "drop-shadow(0 8px 6px rgba(0,0,0,.5)) blur(.15px)" }}
        >
          <RouteChevron />
        </div>
        <div
          className="absolute left-1/2 top-[31%] w-[37%] min-w-[94px] max-w-[180px] opacity-80"
          style={{ transform: `translateX(calc(-50% + ${arrowShift * 0.65}px)) perspective(650px) rotateX(55deg) rotateZ(${turnRotation * 0.8}deg)`, filter: "drop-shadow(0 10px 7px rgba(0,0,0,.48))" }}
        >
          <RouteChevron />
        </div>
        <div
          className="absolute left-1/2 bottom-[-2%] w-[65%] min-w-[150px] max-w-[310px]"
          style={{ transform: `translateX(calc(-50% + ${arrowShift}px)) perspective(650px) rotateX(55deg) rotateZ(${turnRotation}deg)`, filter: "drop-shadow(0 14px 9px rgba(0,0,0,.55))" }}
        >
          <RouteChevron />
        </div>
      </div>

      {heading !== null && (
        <div className="absolute right-3 top-[25%] z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-3 py-2 text-[13px] font-semibold text-white/90 backdrop-blur-md">
          <Compass size={13} className="text-cyan-200" /> {Math.round(heading)}°
        </div>
      )}

      {/* Real street tiles and the returned route are kept visible in a curved bottom mini-map. */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 h-[29%] min-h-[116px] max-h-[178px] overflow-hidden border-t-[3px] border-white/90 bg-[#f4f5f3] shadow-[0_-14px_34px_rgba(0,0,0,.24)]"
        style={{ clipPath: "ellipse(122% 100% at 50% 100%)" }}
      >
        <CameraMiniMap
          location={miniMapLocation}
          currentRoute={route}
          destination={routeDestination ?? undefined}
          variant="companion"
          className="h-full w-full rounded-none border-0"
        />
      </div>

      <div className="absolute inset-x-3 bottom-[29%] z-30 flex justify-center pb-2">
        <div className="max-w-full rounded-[14px] border border-white/20 bg-[#08141c]/90 px-3 py-2 text-center shadow-[0_5px_22px_rgba(0,0,0,.4)] backdrop-blur-md">
          <p className="line-clamp-2 text-[16px] font-bold leading-5 text-white">{instruction || "Аюулгүй бүс рүү буцах замыг тооцоолж байна…"}</p>
          <p className="mt-1 text-[13px] font-semibold text-cyan-100/90">
            {remainingDistance === null ? "Зай хүлээгдэж байна" : `${formatDistance(remainingDistance)} үлдсэн`}
            {heading === null ? ` · ${compassNote}` : ` · Луужин ${Math.round(heading)}°`}
          </p>
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
