"use client";
 
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PhoneIcon, StatusIndicator } from "@/components/safe-path";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { useGeolocation } from "@/hooks/use-geolocation";
import { calculateSafetyState } from "@/lib/risk-engine";
import { SAFE_ZONES } from "@/lib/safe-zones";
 
const LiveMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-80 place-items-center text-sm text-(--sp-muted)">
      Газрын зураг ачаалж байна…
    </div>
  ),
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
  if (level === "CAUTION" || level === "MEDIUM_RISK" || level === "MEDIUM")
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
type TimelineEvent = { time: string; label: string; done: boolean };
 
const timeline: TimelineEvent[] = [
  { time: "08:05", label: "Гэрээс гарсан", done: true },
  { time: "08:24", label: "Сургуульд ирсэн", done: true },
  { time: "16:10", label: "Сургуулиас гарсан", done: true },
  { time: "16:40", label: "Гэртээ ирэх ёстой", done: false },
];
 
export default function GuardianPage() {
  const { location, status: locationStatus, error } = useGeolocation();
  const { settings } = useAssistantSettings();
  const now = useNow();
  const [mapKey, setMapKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>("map");
 
  const childName = settings.userName || "Тэмүүлэн";
  const phone = (settings as { emergencyPhone?: string }).emergencyPhone ?? "";
 
  const loc = location as
    | (typeof location & { timestamp?: number; accuracy?: number })
    | null;
 
  const [prevLocation, setPrevLocation] = useState(location);
  const [lastUpdate, setLastUpdate] = useState<number | null>(
    loc ? (loc.timestamp ?? now) : null,
  );
  if (location !== prevLocation) {
    setPrevLocation(location);
    setLastUpdate(loc ? (loc.timestamp ?? now) : null);
  }
 
  const safetyState = useMemo(
    () => (location ? calculateSafetyState({ location }) : null),
    [location],
  );
 
  const tone = toneOf(safetyState?.riskLevel);
  const zone = safetyState?.nearestSafeZone;
  const distance = location && zone ? distanceMeters(location, zone) : null;
  const inside = Boolean(safetyState?.isInsideSafeZone);
 
  const headline = !safetyState
    ? "Байршлыг тогтоож байна"
    : tone === "risk"
      ? "Маршрутаас хазайсан байна"
      : inside
        ? "Аюулгүй бүсэд байна"
        : "Аюулгүй бүсээс гадуур";
 
  const subline = !zone
    ? (error ?? "Түр хүлээнэ үү")
    : inside
      ? zone.name
      : `Хамгийн ойр: ${zone.name} · ${
          distance !== null ? formatDistance(distance) : "—"
        }`;
 
  const currentRoute: [number, number][] =
    location && zone
      ? [
          [location.latitude, location.longitude],
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
        <main className="relative min-h-dvh pb-[calc(150px+env(safe-area-inset-bottom))]">
          <header className="flex min-h-16 items-center justify-between gap-3 px-5 pt-[env(safe-area-inset-top)]">
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
            className={`mx-4 mb-3 rounded-2xl px-4 py-3 ${TONE[tone].bg}`}
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
 
          <div id="location" className="px-4">
            <div className="relative h-[46vh] min-h-80 max-h-125 overflow-hidden rounded-[22px] border border-(--sp-line) bg-(--sp-surface)">
              {location ? (
                <>
                  <LiveMap
                    key={mapKey}
                    location={location}
                    safeZones={SAFE_ZONES}
                    currentRoute={currentRoute}
                    familiarRoute={familiarRoute}
                    className="h-full rounded-none border-0"
                  />
 
                  {typeof loc?.accuracy === "number" && (
                    <span className="absolute left-3 top-3 z-400 rounded-full border border-(--sp-line) bg-black/75 px-2.5 py-1 text-[11px] text-(--sp-muted) shadow-sm backdrop-blur">
                      ±{Math.round(loc.accuracy)} м
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
                  {locationStatus === "loading"
                    ? "Одоогийн байршлыг тогтоож байна…"
                    : error || "Байршил хараахан олдсонгүй"}
                </div>
              )}
            </div>
          </div>
 
          <section className="px-5 pt-4" aria-label="Одоогийн мэдээлэл">
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
 
          <section id="events" className="px-5 pt-5">
            <h2 className="text-[16px] font-semibold">Өнөөдрийн үйл явдал</h2>
            <ol className="relative mt-3 ml-1 border-l border-(--sp-line)">
              {timeline.map((event) => (
                <li
                  key={event.time + event.label}
                  className="relative pb-4 pl-5 last:pb-0"
                >
                  <span
                    className={`absolute -left-1.25 top-1.5 size-2.5 rounded-full ${
                      event.done
                        ? "bg-(--sp-secondary)"
                        : "border border-(--sp-muted) bg-black"
                    }`}
                  />
                  <div
                    className={`flex items-baseline gap-3 ${
                      event.done ? "" : "text-(--sp-muted)"
                    }`}
                  >
                    <time className="w-11 shrink-0 text-xs tabular-nums text-(--sp-muted)">
                      {event.time}
                    </time>
                    <p className="text-[14px] leading-5">{event.label}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </main>
 
        <TabBar
          active={activeTab}
          onSelect={setActiveTab}
          alert={tone === "risk"}
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
  alert,
}: {
  active: TabId;
  onSelect: (id: TabId) => void;
  alert?: boolean;
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
                  {tab.id === "alerts" && alert && (
                    <span className="absolute right-3 top-1 size-2 rounded-full bg-(--sp-risk) ring-2 ring-black" />
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
 
 