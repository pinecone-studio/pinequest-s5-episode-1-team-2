"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PhoneIcon, StatusIndicator } from "@/components/safe-path";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useChildLocations } from "@/hooks/use-child-locations";
import { useSafetyAlerts } from "@/hooks/use-safety-alerts";
import { DemoNotificationButton } from "@/components/demo-notification-button";
import { SafePathLoading } from "@/components/safepath-loading";
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

function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
export default function GuardianPage() {
  const { location, status: locationStatus, error } = useGeolocation();
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
  const [tabNavigationReady, setTabNavigationReady] = useState(false);
  const [showLocationPermissionNotice, setShowLocationPermissionNotice] = useState(false);

  useEffect(() => {
    if (!tabNavigationReady || activeTab !== "map") {
      setShowLocationPermissionNotice(false);
      return;
    }
    if (error?.includes("зөвшөөрөл хаалттай")) setShowLocationPermissionNotice(true);
  }, [activeTab, error, tabNavigationReady]);

  useEffect(() => {
    const openNotificationsFromHash = () => {
      if (window.location.hash !== "#events") return;
      setActiveTab("alerts");
      window.setTimeout(() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" }), 0);
    };
    openNotificationsFromHash();
    setTabNavigationReady(true);
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

  const childName = settings.userName || "Тэмүүлэн";
  const phone = (settings as { emergencyPhone?: string }).emergencyPhone ?? "";

  // The guardian dashboard must assess the linked child's reported position,
  // not the guardian's own phone GPS. Use the child's configured zones when available.
  const monitoredChild = linkedChildren?.find((child) => child.position) ?? null;
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
  const displayLocation = monitoredLocation ?? location;
  const lastUpdate = monitoredLocation
    ? monitoredLocation.lastUpdated
    : null;
  const loc = displayLocation as
    | (typeof displayLocation & { timestamp?: number; accuracy?: number })
    | null;

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
    ? (error?.includes("зөвшөөрөл хаалттай") ? "Байршлын мэдээлэл хүлээгдэж байна" : error ?? "Түр хүлээнэ үү")
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
        {showLocationPermissionNotice && (
          <div onClick={() => setShowLocationPermissionNotice(false)} className="fixed inset-0 z-[1000] grid place-items-center bg-black/70 px-5 py-8 backdrop-blur-sm" role="presentation">
            <section onClick={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="location-permission-title" className="w-full max-w-sm rounded-3xl border border-(--sp-line) bg-[#0c171b] p-6 text-(--sp-ink) shadow-2xl">
              <h2 id="location-permission-title" className="text-lg font-bold">Байршлын зөвшөөрөл хэрэгтэй</h2>
              <p className="mt-3 text-sm leading-6 text-(--sp-muted)">Байршлыг харахын тулд төхөөрөмжийн тохиргооноос SafePath-д байршлын зөвшөөрөл өгнө үү.</p>
              <button type="button" autoFocus onClick={() => setShowLocationPermissionNotice(false)} className="mt-5 min-h-11 w-full rounded-xl bg-[#4F8FA8] px-4 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Ойлголоо</button>
            </section>
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 mx-auto h-56 max-w-107.5 bg-[radial-gradient(60%_80%_at_80%_0%,rgba(79,143,168,0.22),transparent_70%)]"
        />
        <main className="relative min-h-dvh pb-[calc(150px+env(safe-area-inset-bottom))]">
          {!isOnline && (
            <div role="status" aria-live="polite" className="mx-4 mt-3 rounded-xl border border-amber-300/35 bg-amber-950/70 px-3 py-2 text-sm leading-5 text-amber-100">
              Интернет тасарсан байна. Хүүхдийн сүүлийн мэдээлэл харагдаж болох ч шинэ байршил, Safe Zone дохио серверээс шинэчлэгдэхгүй байж болно.
            </div>
          )}
          <header className="flex min-h-16 items-center justify-between gap-3 px-5 pt-[env(safe-area-inset-top)]">
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-(--sp-line) px-5 pt-[env(safe-area-inset-top)]">
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
            <StatusIndicator status={safetyState?.riskLevel ?? "SAFE"} />
          </header>

          <section
            role={tone === "risk" ? "alert" : "status"}
            aria-live="polite"
            className={`mx-4 mb-3 rounded-2xl px-4 py-3 ${TONE[tone].bg} ${activeTab === "alerts" ? "hidden" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`size-2.5 shrink-0 rounded-full ${TONE[tone].bar} ${
                  tone === "risk" ? "animate-pulse" : ""
                }`}
              />
              <p className={`text-[17px] font-semibold ${TONE[tone].text}`}>
                {headline}
              </p>
            </div>
            <p className="mt-1 pl-4.5 text-sm text-(--sp-muted)">
              {subline} · {formatRelative(lastUpdate, now)}
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
                  return (
                    <div key={child.childId} className="rounded-xl border border-(--sp-line) p-3">
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
                    <Legend dot="bg-[var(--sp-primary)]" label="Байршил" />
                    <Legend dot="bg-(--sp-secondary)" label="Одоогийн зам" />
                    <span className="inline-flex items-center gap-1.5">
                      <i className="h-0 w-4 border-t border-dashed border-(--sp-muted)" />
                      Танил зам
                    </span>
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center px-8 text-center text-sm leading-6 text-(--sp-muted)">
                  {linkedChildren && linkedChildren.length > 0 && !monitoredLocation
                    ? "Хүүхдийн байршлын мэдээлэл хараахан ирээгүй байна"
                    : locationStatus === "loading"
                      ? <SafePathLoading className="flex-col gap-1" label="Одоогийн байршлыг тогтоож байна…" />
                      : error?.includes("зөвшөөрөл хаалттай") ? "Байршлын мэдээлэл хүлээгдэж байна" : error || "Байршил хараахан олдсонгүй"}
                </div>
              )}
            </div>
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
                      : `${zone.name}-с ${
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

        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-107.5 border-t border-(--sp-line) bg-black px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${phone || "+97600000000"}`}
              className="inline-flex min-h-12.5 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--sp-primary-deep)_0%,var(--sp-primary)_100%)] text-[15px] font-semibold text-green-300 shadow-[0_0_24px_-6px_rgba(79,143,168,0.75)] transition-transform active:scale-[0.97]"
            >
              <PhoneIcon />
              Залгах
            </a>
            <a
              href="#location"
              onClick={() => setActiveTab("map")}
              className="inline-flex min-h-12.5 items-center justify-center rounded-2xl border border-[rgba(79,143,168,0.35)] bg-(--sp-primary-soft) text-[15px] font-medium text-(--sp-primary) backdrop-blur transition-transform active:scale-[0.97]"
            >
              Байршил
            </a>
          </div>
        </div>
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
      className="fixed inset-x-0 bottom-[calc(74px+env(safe-area-inset-bottom))] z-20 mx-auto w-full max-w-107.5 border-t border-[rgba(79,143,168,0.15)] bg-black/85 backdrop-blur-xl"
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

