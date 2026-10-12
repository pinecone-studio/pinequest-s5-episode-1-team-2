"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Camera, CameraOff, Compass, MapPin } from "lucide-react";

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
    <div className="grid h-full w-full place-items-center bg-[#f4f5f3] text-xs text-[#4b5563]">
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
}: ArNavigationCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [heading, setHeading] = useState<number | null>(null);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [compassNote, setCompassNote] = useState("Утсаа хөдөлгөж луужинг тохируулна уу.");

  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;

    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraError("Камерын дүрсийг тоглуулж чадсангүй. Камерын зөвшөөрлөө шалгаарай.");
    });

    return () => {
      stream.getTracks().forEach((track) => track.stop());
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

  const stopCamera = useCallback(() => {
    setStream(null);
    setCompassEnabled(false);
    setHeading(null);
    setCompassNote("Утсаа хөдөлгөж луужинг тохируулна уу.");
    setCameraError("");
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Камер ашиглах боломжгүй байна. HTTPS хаяг эсвэл шинэчилсэн browser ашиглана уу.");
      return;
    }

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
        setCompassNote("Луужингийн мэдрэгчийг нээж чадсангүй.");
      }
    } else {
      setCompassEnabled(true);
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setStream(nextStream);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraError("Камерын зөвшөөрөл хаалттай байна. Browser-ийн Settings дээр Camera-г Allow болгоорой.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCameraError("Арын камер олдсонгүй. Төхөөрөмжийн камерыг шалгана уу.");
      } else {
        setCameraError("Камер нээгдсэнгүй. Өөр апп камерыг ашиглаж байгаа эсэх, HTTPS холболтоо шалгаарай.");
      }
    }
  }, []);

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
            <div className="flex max-w-[250px] flex-col items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-center text-[#d4e1e5] backdrop-blur-sm">
              <Camera size={36} strokeWidth={1.4} />
              <p className="text-sm leading-5">Арын камерыг асаагаад зам дээрх чиглэлийн сумыг хараарай.</p>
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
          </div>
        </div>
        <button
          type="button"
          onClick={() => (stream ? stopCamera() : void startCamera())}
          className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-[16px] border border-white/20 bg-[#071116]/85 px-3 text-xs font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-[#122730] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          aria-label={stream ? "Камерыг унтраах" : "Арын камерыг асаах"}
        >
          {stream ? <CameraOff size={18} /> : <Camera size={18} />}
          <span>{stream ? "Унтраах" : "Камер асаах"}</span>
        </button>
      </div>

      {cameraError && (
        <p role="alert" className="absolute inset-x-3 top-[82px] z-30 rounded-xl border border-rose-200/30 bg-rose-950/90 px-3 py-2 text-xs leading-5 text-rose-50 shadow-lg">
          {cameraError}
        </p>
      )}

      {/* Floating turn instruction. The arrows below deliberately sit on the camera view, not inside a compass dial. */}
      <div className="absolute inset-x-4 top-[17%] z-20 flex justify-center">
        <div className="max-w-full rounded-full border border-white/25 bg-black/50 px-3 py-1.5 text-center text-xs font-semibold text-white shadow-lg backdrop-blur-md">
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
        <div className="absolute right-3 top-[25%] z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-2.5 py-1.5 text-[10px] font-medium text-white/90 backdrop-blur-md">
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
          <p className="line-clamp-2 text-xs font-semibold leading-4 text-white">{instruction || "Аюулгүй бүс рүү буцах замыг тооцоолж байна…"}</p>
          <p className="mt-1 text-[10px] font-medium text-cyan-100/90">
            {remainingDistance === null ? "Зай хүлээгдэж байна" : `${formatDistance(remainingDistance)} үлдсэн`}
            {heading === null ? ` · ${compassNote}` : ` · Луужин ${Math.round(heading)}°`}
          </p>
        </div>
      </div>

    </div>
  );
}
