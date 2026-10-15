"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronLeft, MapPin, Navigation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PhoneIcon, StatusIndicator } from "@/components/safe-path";
import { BackButton } from "@/components/back-button";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useChildLocations } from "@/hooks/use-child-locations";
import { useChildAddress } from "@/hooks/use-child-address";
import { useSafetyAlerts } from "@/hooks/use-safety-alerts";
import { DemoNotificationButton } from "@/components/demo-notification-button";
import { SafePathLoading } from "@/components/safepath-loading";
import type { MapPerson } from "@/components/live-map";
import type { PlaceDescription } from "@/lib/reverse-geocode";
import type { SeenLandmark } from "@/types/location";
import { SCENE_LANDMARK_ICONS } from "@/types/vision";
import type { GuardianSafetyAlert } from "@/types/alerts";
import { calculateSafetyState } from "@/lib/risk-engine";
import { SAFE_ZONES } from "@/lib/safe-zones";

const LiveMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => <SafePathLoading className="h-full min-h-80" label="Газрын зураг ачаалж байна…" />,
});

const TOKENS = {
  "--sp-primary": "#4F8FA8",
  "--sp-primary-deep": "#3D7891",
  "--sp-primary-soft": "rgba(79,143,168,0.18)",
  "--sp-secondary": "#72B8B0",
  "--sp-bg": "#000000",
  "--sp-bg-top": "#081619",
  "--sp-bg-bottom": "#000000",
  "--sp-ink": "#E6F1F3",
  "--sp-muted": "#87A0A8",
  "--sp-line": "#1B2C32",
  "--sp-surface": "#0C171B",
  "--sp-safe": "#72B8B0",
  "--sp-safe-bg": "rgba(114,184,176,0.12)",
  "--sp-caution": "#E0A84A",
  "--sp-caution-bg": "rgba(224,168,74,0.12)",
  "--sp-risk": "#E57C66",
  "--sp-risk-bg": "rgba(229,124,102,0.13)",
} as React.CSSProperties;

type Tone = "safe" | "caution" | "risk";

function toneOf(level?: string): Tone {
  if (level === "HIGH_RISK") return "risk";
  if (level === "WARNING" || level === "CAUTION" || level === "MEDIUM_RISK" || level === "MEDIUM")
    return "caution";
  return "safe";
}

const TONE = {
  safe: {
    label: "Аюулгүй",
    text: "text-[var(--sp-safe)]",
    bg: "bg-[var(--sp-safe-bg)]",
    bar: "bg-[var(--sp-safe)]",
  },
  caution: {
    label: "Анхаарах",
    text: "text-[var(--sp-caution)]",
    bg: "bg-[var(--sp-caution-bg)]",
    bar: "bg-[var(--sp-caution)]",
  },
  risk: {
    label: "Өндөр эрсдэл",
    text: "text-[var(--sp-risk)]",
    bg: "bg-[var(--sp-risk-bg)]",
    bar: "bg-(--sp-risk)",
  },
} as const;

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(m: number) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} м`;
  return `${(m / 1000).toFixed(1)} км`;
}

function formatRelative(ts: number | null, now: number) {
  if (!ts) return "Хүлээгдэж байна";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return "Дөнгөж сая";
  if (s < 60) return `${s} сек өмнө`;
  if (s < 3600) return `${Math.floor(s / 60)} мин өмнө`;
  return new Date(ts).toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Above this, the phone is guessing from Wi-Fi or cell towers rather than GPS.
const ROUGH_ACCURACY_METERS = 100;

/** Where the child is in plain words, how sure the phone is, and a one-tap route to them. */
// The child's phone reports every ~10 s while sharing; this long without one means it may be off or offline.
const SILENT_MINUTES = 10;

function ChildWhereabouts({ childId, name, latitude, longitude, accuracy, updated, silentMinutes, batteryLevel, charging, photo, landmarks, address, addressFailed }: {
  childId: string;
  name: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  updated: string;
  /** Minutes since the last report. */
  silentMinutes: number;
  batteryLevel: number | null;
  charging: boolean | null;
  /** The newest surroundings photo from the child's camera, with how long ago it was taken. */
  photo: { id: string; takenAt: string; taken: string } | null;
  /** The newest notable places the child's camera saw, with how long ago. */
  landmarks: (SeenLandmark & { seen: string })[];
  address: PlaceDescription | null;
  addressFailed: boolean;
}) {
  const headline = address?.place
    ? `${address.place} орчим`
    : address?.street ?? (addressFailed ? "Хаягийг тодорхойлж чадсангүй" : address ? "Нэргүй газар" : "Хаягийг тодорхойлж байна…");
  const details = [address?.place ? address.street : null, address?.area].filter(Boolean).join(", ");
  const rough = accuracy > ROUGH_ACCURACY_METERS;
  const silent = silentMinutes >= SILENT_MINUTES;
  const batteryPercent = batteryLevel === null ? null : Math.round(batteryLevel * 100);
  const batteryLow = batteryPercent !== null && batteryPercent <= 15 && charging !== true;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude.toFixed(6)},${longitude.toFixed(6)}&travelmode=walking`;

  return (
    <section className="mt-3 rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-4" aria-label={`${name} одоо хаана байна`} aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#2a7fff]/15 text-[#2a7fff]" aria-hidden="true">
          <MapPin size={20} />
        </span>
        <div className="min-w-0">
          <p className={`text-xs ${silent ? "font-semibold text-(--sp-caution)" : "text-(--sp-muted)"}`}>
            {silent ? `📵 Утастай холбоо тасарсан · сүүлийн мэдээлэл ${updated}` : `${name} одоо энд байна`}
          </p>
          <p className="mt-0.5 text-[17px] font-semibold leading-6">{headline}</p>
          {details && <p className="mt-0.5 text-sm leading-5 text-(--sp-muted)">{details}</p>}
          <p className={`mt-1.5 text-xs ${rough ? "text-(--sp-caution)" : "text-(--sp-muted)"}`}>
            ±{Math.round(accuracy)} м нарийвчлалтай · {updated}
            {batteryPercent !== null && (
              <span className={batteryLow ? "font-semibold text-(--sp-risk)" : ""}>
                {" "}· {charging ? "🔌" : "🔋"} {batteryPercent}%
              </span>
            )}
          </p>
          {silent && (
            <p className="mt-1 text-xs leading-5 text-(--sp-caution)">
              Утас унтарсан эсвэл сүлжээгүй байж магадгүй. Доорх нь хамгийн сүүлд илгээсэн байршил{batteryPercent !== null ? `, тэр үед цэнэг ${batteryPercent}% байсан` : ""}.
            </p>
          )}
          {rough && (
            <p className="mt-1 text-xs leading-5 text-(--sp-caution)">
              Байршил тойм байна. Хүүхдийн утсанд GPS асаалттай, гадаа байгаа эсэхийг шалгаарай.
            </p>
          )}
        </div>
      </div>
      {photo && (
        <div className="mt-3 border-t border-(--sp-line) pt-3">
          <p className="text-xs text-(--sp-muted)">📷 Камер нээгдэх үеийн орчны зураг · {photo.taken}</p>
          <a
            href={`/api/scene-photo?childId=${encodeURIComponent(childId)}&id=${encodeURIComponent(photo.id)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block overflow-hidden rounded-xl border border-(--sp-line) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fff]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-guardian image route; next/image would cache it publicly. */}
            <img
              src={`/api/scene-photo?childId=${encodeURIComponent(childId)}&id=${encodeURIComponent(photo.id)}`}
              alt={`${name} камераа нээх үед харж байсан орчин`}
              className="max-h-64 w-full object-cover"
              loading="lazy"
            />
          </a>
        </div>
      )}
      {landmarks.length > 0 && (
        <div className="mt-3 border-t border-(--sp-line) pt-3">
          <p className="text-xs text-(--sp-muted)">Замдаа харсан тод газрууд</p>
          <ul className="mt-2 space-y-2">
            {landmarks.map((landmark) => (
              <li key={landmark.id} className="flex items-start gap-2.5">
                <span className="text-lg leading-6" aria-hidden="true">{SCENE_LANDMARK_ICONS[landmark.kind]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-6">{landmark.label}</p>
                  {landmark.detail && <p className="text-xs leading-5 text-(--sp-muted)">{landmark.detail}</p>}
                </div>
                <span className="shrink-0 text-xs leading-6 text-(--sp-muted)">{landmark.seen}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <a
        href={directionsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2a7fff] px-4 text-sm font-semibold text-white transition hover:bg-[#1c6fee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fff]"
      >
        <Navigation size={16} aria-hidden="true" /> {name} хүртэл чиглэл авах
      </a>
      <Link
        href={`/guardian/checkpoints?child=${childId}`}
        className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#7c3aed]/50 px-4 text-sm font-semibold text-[#c4b5fd] transition hover:bg-[#7c3aed]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c3aed]"
      >
        <span aria-hidden="true">🎯</span> Шалгах цэг, шагнал өгөх
      </Link>
    </section>
  );
}

function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function GuardianPage() {
  const { location } = useGeolocation();
  const isOnline = useNetworkStatus();
  const { settings } = useAssistantSettings();
  const { children: linkedChildren, failed: childrenLoadFailed } = useChildLocations();
  const { alerts, failed: alertsLoadFailed, markRead: markSafetyAlertRead } = useSafetyAlerts();
  const [demoAlert, setDemoAlert] = useState<GuardianSafetyAlert | null>(null);
  const now = useNow();
  const visibleAlerts = demoAlert ? [demoAlert, ...alerts] : alerts;
  const unreadAlertCount = visibleAlerts.filter((alert) => !alert.read).length;
  const urgentSos = visibleAlerts.find((alert) => alert.type === "SOS" && !alert.read) ?? null;
  const [mapKey, setMapKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>("map");
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    const openNotificationsFromHash = () => {
      if (window.location.hash !== "#events") return;
      setActiveTab("alerts");
      window.setTimeout(() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" }), 0);
    };
    openNotificationsFromHash();
    window.addEventListener("hashchange", openNotificationsFromHash);
    return () => window.removeEventListener("hashchange", openNotificationsFromHash);
  }, []);

  const selectTab = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === "alerts" || tab === "map") {
      const target = tab === "alerts" ? "events" : "location";
      window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth" }), 0);
    }
  };

  const phone = (settings as { emergencyPhone?: string }).emergencyPhone ?? "";

  const monitoredChild =
    linkedChildren?.find((child) => child.childId === selectedChildId && child.position) ??
    linkedChildren?.find((child) => child.position) ??
    null;
  const childName = monitoredChild?.name ?? linkedChildren?.[0]?.name ?? settings.userName ?? "Хүүхэд";
  const monitoredLocation = monitoredChild?.position
    ? {
        latitude: monitoredChild.position.latitude,
        longitude: monitoredChild.position.longitude,
        accuracy: monitoredChild.position.accuracy,
        lastUpdated: new Date(monitoredChild.position.updatedAt).getTime(),
      }
    : null;
  const monitoredZones = monitoredChild?.zones?.length
    ? monitoredChild.zones
    : SAFE_ZONES;
  
  const displayLocation = monitoredLocation;
  const { address: childAddress, failed: childAddressFailed } = useChildAddress(monitoredChild?.childId ?? null, monitoredLocation);
  const mapPeople: MapPerson[] = (linkedChildren ?? []).flatMap((child) =>
    child.position && !child.paused
      ? [{
          id: child.childId,
          name: child.name,
          latitude: child.position.latitude,
          longitude: child.position.longitude,
          fresh: now - new Date(child.position.updatedAt).getTime() < 120_000,
          selected: child.childId === monitoredChild?.childId,
          accuracy: child.position.accuracy,
        }]
      : [],
  );
  const lastUpdate = monitoredLocation
    ? monitoredLocation.lastUpdated
    : null;
  const safetyState = useMemo(
    () =>
      monitoredLocation
        ? calculateSafetyState({ location: monitoredLocation, safeZones: monitoredZones })
        : null,
    [monitoredLocation?.latitude, monitoredLocation?.longitude, monitoredZones],
  );

  const tone = toneOf(safetyState?.riskLevel);
  const zone = safetyState?.nearestSafeZone;
  const distance = monitoredLocation && zone ? distanceMeters(monitoredLocation, zone) : null;
  const inside = Boolean(safetyState?.isInsideSafeZone);

  const headline = !safetyState
    ? "Байршлыг тогтоож байна"
    : tone === "risk"
      ? "Аюулгүй бүсээс гарсан байна"
      : inside
        ? "Аюулгүй бүсэд байна"
        : "Аюулгүй бүсээс гадуур";

  const subline = !zone
    ? (linkedChildren === null ? "Түр хүлээнэ үү" : "Хүүхдийн байршил хүлээгдэж байна")
    : inside
      ? zone.name
      : `Хамгийн ойр: ${zone.name} · ${
          distance !== null ? formatDistance(distance) : "—"
        }`;

  const currentRoute: [number, number][] =
    monitoredLocation && zone
      ? [
          [monitoredLocation.latitude, monitoredLocation.longitude],
          [zone.latitude, zone.longitude],
        ]
      : [];

  const familiarRoute: [number, number][] = [
    [SAFE_ZONES[0].latitude, SAFE_ZONES[0].longitude],
    [47.9212, 106.9176],
    [SAFE_ZONES[1].latitude, SAFE_ZONES[1].longitude],
  ];

  return (
    <AppShell>
      <div
        style={TOKENS}
        className="min-h-dvh bg-[linear-gradient(180deg,var(--sp-bg-top)_0%,var(--sp-bg-bottom)_45%,var(--sp-bg-bottom)_100%)] text-(--sp-ink)"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 mx-auto h-56 max-w-107.5 bg-[radial-gradient(60%_80%_at_80%_0%,rgba(79,143,168,0.22),transparent_70%)]"
        />
        <main className="relative min-h-dvh pb-[calc(84px+env(safe-area-inset-bottom))]">
          {!isOnline && (
            <div role="status" aria-live="polite" className="mx-4 mt-3 rounded-xl border border-amber-300/35 bg-amber-950/70 px-3 py-2 text-sm leading-5 text-amber-100">
              Интернет тасарсан байна. Хүүхдийн сүүлийн мэдээлэл харагдаж болох ч шинэ байршил, Safe Zone дохио серверээс шинэчлэгдэхгүй байж болно.
            </div>
          )}
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-(--sp-line) px-5 pt-[env(safe-area-inset-top)]">
            <div className="flex min-w-0 items-center gap-1">
              <BackButton className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full transition hover:bg-(--sp-line) focus-visible:outline-2 focus-visible:outline-offset-2">
                <ChevronLeft size={24} aria-hidden="true" />
              </BackButton>
              <div className="min-w-0">
                <Link
                  href="/"
                  className="text-[17px] font-semibold tracking-tight"
                >
                  SafePath
                </Link>
                <p className="mt-0.5 truncate text-sm text-(--sp-muted)">
                  {childName}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {safetyState ? (
                <StatusIndicator status={safetyState.riskLevel} />
              ) : (
                <span className="inline-flex min-h-11 items-center gap-2 text-[13px] font-medium tracking-[0.02em] text-(--sp-muted)">
                  <span className="size-2 rounded-full bg-current" aria-hidden="true" />
                  ТОДОРХОЙГҮЙ
                </span>
              )}
              {phone && (
                <a
                  href={`tel:${phone}`}
                  aria-label="Яаралтай дугаар руу залгах"
                  className="grid size-11 place-items-center rounded-full text-emerald-400 transition hover:bg-emerald-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <PhoneIcon />
                </a>
              )}
            </div>
          </header>

          <section
            role={tone === "risk" ? "alert" : "status"}
            aria-live="polite"
            className={`mx-4 mb-3 mt-3 rounded-2xl px-4 py-3 ${safetyState ? TONE[tone].bg : "bg-(--sp-surface)"} ${activeTab === "alerts" ? "hidden" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`size-2.5 shrink-0 rounded-full ${safetyState ? TONE[tone].bar : "bg-(--sp-muted)"} ${
                  tone === "risk" ? "animate-pulse" : ""
                }`}
              />
              <p className={`text-[17px] font-semibold ${safetyState ? TONE[tone].text : "text-(--sp-ink)"}`}>
                {headline}
              </p>
            </div>
            <p className="mt-1 pl-4.5 text-sm text-(--sp-muted)">
              {lastUpdate ? `${subline} · ${formatRelative(lastUpdate, now)}` : subline}
            </p>
          </section>

          {activeTab !== "alerts" && urgentSos && (
            <section role="alert" aria-live="assertive" className="mx-4 mb-5 overflow-hidden rounded-[24px] border-2 border-rose-500 bg-[linear-gradient(145deg,rgba(127,29,29,0.62),rgba(30,8,12,0.96))] p-5 shadow-[0_12px_36px_rgba(244,63,94,0.22)] sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rose-500/20 text-2xl" aria-hidden="true">🆘</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-200">Яаралтай мэдэгдэл</p>
                  <h2 className="mt-0.5 text-xl font-extrabold leading-tight text-rose-100 sm:text-2xl">Хүүхэд тусламж хүссэн</h2>
                </div>
              </div>
              <p className="mt-4 text-base font-semibold text-white">{urgentSos.childName} · {formatRelative(new Date(urgentSos.createdAt).getTime(), now)}</p>
              <p className="mt-2 text-sm leading-6 text-rose-50/90">{urgentSos.message}</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => selectTab("alerts")} className="min-h-12 rounded-xl bg-rose-500 px-3 text-sm font-bold text-white transition hover:bg-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Мэдэгдэл харах</button>
                <button type="button" onClick={() => selectTab("map")} className="min-h-12 rounded-xl border border-rose-200/40 bg-black/20 px-3 text-sm font-semibold text-rose-50 transition hover:bg-black/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Байршил шалгах</button>
              </div>
            </section>
          )}

          <section className={`mx-4 mb-4 rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-4 ${activeTab === "alerts" ? "hidden" : ""}`} aria-label="Холбогдсон хүүхдүүд">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Холбогдсон хүүхдүүд</h2>
              <span className="text-xs text-(--sp-muted)">5 сек тутам шинэчилнэ</span>
            </div>
            {childrenLoadFailed ? (
              <p className="text-sm text-(--sp-muted)">Байршлын мэдээлэл авч чадсангүй. Нэвтэрсэн эрх болон холболтоо шалгана уу.</p>
            ) : linkedChildren === null ? (
              <SafePathLoading className="justify-start px-0 py-1" label="Хүүхдийн мэдээлэл ачаалж байна…" />
            ) : linkedChildren.length === 0 ? (
              <p className="text-sm text-(--sp-muted)">Одоогоор холбогдсон хүүхэд алга. Хүүхдийн бүртгэлийг холбосны дараа байршил энд харагдана.</p>
            ) : (
              <div className="space-y-3">
                {linkedChildren.map((child) => {
                  const point = child.position;
                  const meters = location && point ? distanceMeters(location, point) : null;
                  const age = point ? Math.max(0, (now - new Date(point.updatedAt).getTime()) / 1000) : null;
                  const fresh = age !== null && age < 120;
                  const shownOnMap = child.childId === monitoredChild?.childId;
                  return (
                    <div
                      key={child.childId}
                      role={point ? "button" : undefined}
                      tabIndex={point ? 0 : undefined}
                      aria-pressed={point ? shownOnMap : undefined}
                      onClick={point ? () => { setSelectedChildId(child.childId); setMapKey((k) => k + 1); } : undefined}
                      onKeyDown={point ? (event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setSelectedChildId(child.childId);
                        setMapKey((k) => k + 1);
                      } : undefined}
                      className={`rounded-xl border p-3 transition ${shownOnMap ? "border-[#2a7fff]/70 bg-[#2a7fff]/10" : "border-(--sp-line)"} ${point ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fff]" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{child.name}</p>
                          <p className="mt-1 text-xs text-(--sp-muted)">
                            {child.paused ? "Байршил хуваалцахыг түр зогсоосон" : !point ? "Байршил хүлээгдэж байна" : fresh ? `Шинэчлэгдсэн: ${formatRelative(new Date(point.updatedAt).getTime(), now)}` : `Хамгийн сүүлд ${formatRelative(new Date(point.updatedAt).getTime(), now)}`}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${fresh ? "bg-[var(--sp-safe-bg)] text-[var(--sp-safe)]" : "bg-[var(--sp-caution-bg)] text-[var(--sp-caution)]"}`}>
                          {child.paused ? "Түр зогссон" : fresh ? "Live" : "Хуучин мэдээлэл"}
                        </span>
                      </div>
                      {point && !child.paused && (
                        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-(--sp-line) pt-3">
                          <div><p className="text-xs text-(--sp-muted)">Таны байршлаас</p><p className="mt-1 text-sm font-semibold">{meters === null ? "—" : formatDistance(meters)}</p></div>
                          <div><p className="text-xs text-(--sp-muted)">Хүүхдийн хурд</p><p className="mt-1 text-sm font-semibold">{child.speedKmh == null ? "Хэмжиж байна…" : `${child.speedKmh} км/ц`}</p></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div id="location" className={`px-4 ${activeTab === "alerts" ? "hidden" : ""}`}>
            <div className="relative h-[46vh] min-h-80 max-h-125 overflow-hidden rounded-[22px] border border-(--sp-line) bg-(--sp-surface)">
              {displayLocation ? (
                <>
                  <LiveMap
                    key={mapKey}
                    location={displayLocation}
                    people={mapPeople}
                    landmarks={monitoredChild?.landmarks ?? []}
                    safeZones={monitoredZones}
                    currentRoute={currentRoute}
                    familiarRoute={familiarRoute}
                    className="h-full rounded-none border-0"
                  />

                  {typeof displayLocation.accuracy === "number" && (
                    <span className="absolute left-3 top-3 z-400 rounded-full border border-(--sp-line) bg-black/75 px-2.5 py-1 text-[11px] text-(--sp-muted) shadow-sm backdrop-blur">
                      ±{Math.round(displayLocation.accuracy)} м
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setMapKey((k) => k + 1)}
                    aria-label="Одоогийн байршил руу буцах"
                    className="absolute right-3 top-3 z-400 grid size-10 place-items-center rounded-full border border-(--sp-line) bg-black/80 text-(--sp-primary) shadow-sm"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                    </svg>
                  </button>

                  <div
                    aria-label="Газрын зургийн тэмдэглэгээ"
                    className="absolute bottom-3 left-3 z-400 flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-(--sp-line) bg-black/75 px-3 py-2 text-[11px] text-(--sp-muted) shadow-sm backdrop-blur"
                  >
                    <Legend dot="bg-[#2a7fff]" label="Хүүхэд" />
                    <Legend dot="bg-[#f59e0b]" label="Харсан газар" />
                    <Legend dot="bg-(--sp-secondary)" label="Одоогийн зам" />
                    <span className="inline-flex items-center gap-1.5">
                      <i className="h-0 w-4 border-t border-dashed border-(--sp-muted)" />
                      Танил зам
                    </span>
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center px-8 text-center text-sm leading-6 text-(--sp-muted)">
                  {linkedChildren === null
                    ? <SafePathLoading className="flex-col gap-1" label="Хүүхдийн байршлыг ачаалж байна…" />
                    : linkedChildren.length === 0
                      ? "Хүүхэд холбогдоогүй байна. Хүүхдийн бүртгэлийг холбосны дараа байршил энд харагдана."
                      : "Хүүхдийн байршил хараахан ирээгүй байна. Хүүхдийн утсан дээр SafePath нээлттэй, байршлын зөвшөөрөл өгсөн эсэхийг шалгаарай."}
                </div>
              )}
            </div>

            {monitoredChild && displayLocation && (
              <ChildWhereabouts
                childId={monitoredChild.childId}
                name={monitoredChild.name}
                latitude={displayLocation.latitude}
                longitude={displayLocation.longitude}
                accuracy={displayLocation.accuracy}
                updated={formatRelative(displayLocation.lastUpdated, now)}
                silentMinutes={Math.max(0, Math.floor((now - displayLocation.lastUpdated) / 60_000))}
                batteryLevel={monitoredChild.position?.batteryLevel ?? null}
                photo={monitoredChild.photo ? { ...monitoredChild.photo, taken: formatRelative(new Date(monitoredChild.photo.takenAt).getTime(), now) } : null}
                charging={monitoredChild.position?.charging ?? null}
                landmarks={(monitoredChild.landmarks ?? []).slice(0, 3).map((landmark) => ({
                  ...landmark,
                  seen: formatRelative(new Date(landmark.seenAt).getTime(), now),
                }))}
                address={childAddress}
                addressFailed={childAddressFailed}
              />
            )}
          </div>

          <section className={`px-5 pt-4 ${activeTab === "alerts" ? "hidden" : ""}`} aria-label="Одоогийн мэдээлэл">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-y border-(--sp-line) py-3">
              <Info
                label="Байршил"
                value={
                  !zone
                    ? "Тодорхойгүй"
                    : inside
                      ? zone.name
                      : `${zone.name} хүртэл ${
                          distance !== null ? formatDistance(distance) : "—"
                        }`
                }
              />
              <Info
                label="Сүүлийн шинэчлэл"
                value={formatRelative(lastUpdate, now)}
              />
              <div className="col-span-2 min-w-0">
                <dt className="text-[12px] text-(--sp-muted)">Эрсдэл</dt>
                <dd className="mt-1 flex items-center gap-3">
                  <span
                    className={`text-[14px] font-medium ${TONE[tone].text}`}
                  >
                    {safetyState ? TONE[tone].label : "—"}
                  </span>
                  <span
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--sp-line)"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={safetyState?.riskScore ?? 0}
                    aria-label="Эрсдэлийн оноо"
                  >
                    <span
                      className={`block h-full rounded-full transition-all ${TONE[tone].bar}`}
                      style={{ width: `${safetyState?.riskScore ?? 0}%` }}
                    />
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section id="events" className={`px-5 pt-5 ${activeTab === "alerts" ? "" : "hidden"}`} aria-labelledby="safety-alerts-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="safety-alerts-heading" className="text-[20px] font-semibold">Мэдэгдэл</h2>
              <div className="flex items-center gap-2">
                {unreadAlertCount > 0 && (
                  <span className="rounded-full bg-(--sp-risk-bg) px-2.5 py-1 text-xs font-semibold text-(--sp-risk)">
                    {unreadAlertCount} шинэ
                  </span>
                )}
                <DemoNotificationButton onSent={() => setDemoAlert({
                  id: `demo-${Date.now()}`,
                  childId: monitoredChild?.childId ?? "demo-child",
                  childName: monitoredChild?.name ?? "Хүүхэд",
                  type: "SOS",
                  zoneName: null,
                  message: "Энэ бол туршилтын мэдэгдэл. Бодит SOS дохио биш.",
                  createdAt: new Date().toISOString(),
                  read: false,
                })} />
              </div>
            </div>
            <p className="mt-1 text-sm leading-6 text-(--sp-muted)">SOS болон аюулгүй бүсийн мэдэгдлүүд энд харагдана.</p>
            {alertsLoadFailed ? (
              <p className="mt-3 rounded-xl border border-(--sp-line) bg-(--sp-surface) p-3 text-sm leading-6 text-(--sp-muted)">
                Мэдэгдлийг авч чадсангүй. Сүлжээ болон нэвтрэлтийн төлөвөө шалгана уу.
              </p>
            ) : visibleAlerts.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-(--sp-line) bg-(--sp-surface) px-4 py-8 text-center text-sm leading-6 text-(--sp-muted)">
                Одоогоор шинэ мэдэгдэл алга.
                <Link href="/guardian/zones" className="mt-2 block font-medium text-(--sp-primary)">Аюулгүй бүс тохируулах →</Link>
              </div>
            ) : (
              <ol className="mt-3 space-y-2.5">
                {visibleAlerts.map((alert) => {
                  const alertTime = new Date(alert.createdAt).getTime();
                  const isUrgent = alert.type !== "ZONE_ENTER";
                  const label = alert.type === "SOS"
                    ? "🆘 ЯАРАЛТАЙ ТУСЛАМЖ — SOS"
                    : alert.type === "LOW_BATTERY"
                      ? "🪫 Утасны цэнэг дуусах гэж байна"
                    : alert.type === "ZONE_EXIT"
                      ? "Аюулгүй бүсээс гарсан"
                      : alert.type === "ZONE_ENTER"
                        ? "Аюулгүй бүсэд орсон"
                        : "Аюулгүй бүсийн гадна илэрсэн";
                  return (
                    <li key={alert.id} className={`rounded-xl border p-3 ${alert.type === "SOS" ? "border-rose-500/70 bg-rose-500/10" : alert.read ? "border-(--sp-line) bg-(--sp-surface)" : isUrgent ? "border-[rgba(229,124,102,0.45)] bg-[rgba(229,124,102,0.08)]" : "border-[rgba(114,184,176,0.35)] bg-[rgba(114,184,176,0.06)]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${isUrgent ? "text-(--sp-risk)" : "text-(--sp-safe)"}`}>{label}</p>
                          <p className="mt-1 text-xs text-(--sp-muted)">{alert.childName} · {formatRelative(alertTime, now)}</p>
                        </div>
                        {!alert.read && (
                          <button type="button" onClick={() => { if (demoAlert && alert.id === demoAlert.id) setDemoAlert({ ...demoAlert, read: true }); else void markSafetyAlertRead(alert.id); }} className="shrink-0 rounded-lg border border-(--sp-line) px-2.5 py-1.5 text-xs font-medium text-(--sp-ink) hover:bg-white/5">
                            Уншсан
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-(--sp-ink)">{alert.message}</p>
                      {alert.zoneName && <p className="mt-1 text-xs text-(--sp-muted)">Бүс: {alert.zoneName}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </main>

        <TabBar
          active={activeTab}
          onSelect={selectTab}
          unreadCount={unreadAlertCount}
        />

      </div>
    </AppShell>
  );
}

type TabId = "people" | "map" | "alerts" | "settings";

const TABS: {
  id: TabId;
  label: string;
  href: string;
  icon: (filled: boolean) => React.ReactNode;
}[] = [
  {
    id: "people",
    label: "Хүмүүс",
    href: "/guardian/link",
    icon: (f) => <PeopleIcon filled={f} />,
  },
  {
    id: "map",
    label: "Газрын зураг",
    href: "#location",
    icon: (f) => <MapIcon filled={f} />,
  },
  {
    id: "alerts",
    label: "Мэдэгдэл",
    href: "#events",
    icon: (f) => <BellIcon filled={f} />,
  },
  {
    id: "settings",
    label: "Тохиргоо",
    href: "/settings",
    icon: (f) => <GearIcon filled={f} />,
  },
];

function TabBar({
  active,
  onSelect,
  unreadCount,
}: {
  active: TabId;
  onSelect: (id: TabId) => void;
  unreadCount: number;
}) {
  return (
    <nav
      aria-label="Асран хамгаалагчийн цэс"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-107.5 border-t border-[rgba(79,143,168,0.15)] bg-black/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                onClick={() => onSelect(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className="group flex h-15 flex-col items-center justify-center gap-1 select-none [-webkit-tap-highlight-color:transparent]"
              >
                <span
                  className={`relative grid h-8 w-14 place-items-center rounded-full transition-all duration-200 group-active:scale-90 ${
                    isActive
                      ? "bg-(--sp-primary-soft) text-(--sp-primary)"
                      : "text-(--sp-muted)"
                  }`}
                >
                  {tab.icon(isActive)}
                  {tab.id === "alerts" && unreadCount > 0 && (
                    <span aria-label={`${unreadCount} уншаагүй мэдэгдэл`} className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-black">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] leading-none transition-colors ${
                    isActive
                      ? "font-semibold text-(--sp-primary)"
                      : "text-(--sp-muted)"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function IconBase({
  filled,
  children,
}: {
  filled: boolean;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5.5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function PeopleIcon({ filled }: { filled: boolean }) {
  return (
    <IconBase filled={filled}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5v.5h-13z" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M17 14.2c2.6.2 4.5 2 4.5 4.8v1h-4" />
    </IconBase>
  );
}

function MapIcon({ filled }: { filled: boolean }) {
  return (
    <IconBase filled={filled}>
      <path d="M12 21.5s-7-6.1-7-11.7a7 7 0 0 1 14 0c0 5.6-7 11.7-7 11.7z" />
      {filled ? (
        <circle cx="12" cy="9.8" r="2.6" fill="black" />
      ) : (
        <circle cx="12" cy="9.8" r="2.6" />
      )}
    </IconBase>
  );
}

function BellIcon({ filled }: { filled: boolean }) {
  return (
    <IconBase filled={filled}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path
        d="M10 20.5a2.2 2.2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </IconBase>
  );
}

function GearIcon({ filled }: { filled: boolean }) {
  return (
    <IconBase filled={filled}>
      <path d="M10.3 2.8h3.4l.5 2.5 1.7.9 2.4-.9 1.7 2.9-1.9 1.7v2l1.9 1.7-1.7 2.9-2.4-.9-1.7.9-.5 2.5h-3.4l-.5-2.5-1.7-.9-2.4.9-1.7-2.9 1.9-1.7v-2L3.9 8.2l1.7-2.9 2.4.9 1.7-.9z" />
      {filled ? (
        <circle cx="12" cy="11" r="2.8" fill="black" />
      ) : (
        <circle cx="12" cy="11" r="2.8" />
      )}
    </IconBase>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-(--sp-muted)">{label}</dt>
      <dd className="mt-0.5 truncate text-[14px] font-medium">{value}</dd>
    </div>
  );
}