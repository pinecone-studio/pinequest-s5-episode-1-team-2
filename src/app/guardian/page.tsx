"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, PhoneIcon, StatusIndicator } from "@/components/safe-path";
import { useChildLocations } from "@/hooks/use-child-locations";
import { calculateSafetyState } from "@/lib/risk-engine";
import type { ChildLocation } from "@/types/location";
import type { SafeZone, SafetyLocation } from "@/types/safety";

const LiveMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[320px] place-items-center text-sm text-[var(--sp-muted)]">
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
    bar: "bg-[var(--sp-risk)]",
  },
} as const;

function distanceMeters(
  a: {latitude: number; longitude: number},
  b: {latitude: number; longitude: number}
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
type TimelineEvent = {time: string; label: string; done: boolean};

const timeline: TimelineEvent[] = [
  {time: "08:05", label: "Гэрээс гарсан", done: true},
  {time: "08:24", label: "Сургуульд ирсэн", done: true},
  {time: "16:10", label: "Сургуулиас гарсан", done: true},
  {time: "16:40", label: "Гэртээ ирэх ёстой", done: false},
];

/** A position older than this is flagged as out of date. */
const STALE_MS = 2 * 60_000;

export default function GuardianPage() {
  const { children, checkedAt, failed } = useChildLocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const child = children?.find((each) => each.childId === selectedId) ?? children?.[0] ?? null;
  const position = child?.position ?? null;
  const location = useMemo<SafetyLocation | null>(
    () => position && { latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy, lastUpdated: Date.parse(position.updatedAt) },
    [position],
  );
  const ageMs = location && checkedAt ? Math.max(0, checkedAt - location.lastUpdated) : null;
  // The same array until the zones really change: each poll returns new objects, and the map re-fits whenever the array changes.
  const zonesKey = JSON.stringify(child?.zones ?? []);
  const zones = useMemo(() => JSON.parse(zonesKey) as SafeZone[], [zonesKey]);
  // Risk is measured against the zones the guardians set for this child; without any there is nothing to measure.
  const safetyState = useMemo(
    () => (location && zones.length ? calculateSafetyState({ location, safeZones: zones }) : null),
    [location, zones],
  );
  const currentRoute: [number, number][] = location && safetyState
    ? [[location.latitude, location.longitude], [safetyState.nearestSafeZone.latitude, safetyState.nearestSafeZone.longitude]]
    : [];

  return (
    <AppShell>
      <main className="min-h-dvh pb-[calc(124px+env(safe-area-inset-bottom))]">
        <header className="flex min-h-[68px] items-center justify-between gap-3 px-5 pt-[env(safe-area-inset-top)]">
          <div className="min-w-0">
            <Link href="/" className="text-[17px] font-semibold tracking-[-0.025em]">SafePath</Link>
            <p className="mt-0.5 truncate text-sm text-[#737373]">{child?.name ?? "—"}</p>
          </div>
          {safetyState && <StatusIndicator status={safetyState.riskLevel} />}
        </header>

        <div id="location" className="px-4 pt-1">
          {children && children.length > 1 && (
            <div className="mb-3 flex gap-2 overflow-x-auto" role="group" aria-label="Хүүхэд сонгох">
              {children.map((each) => (
                <button key={each.childId} type="button" aria-pressed={each.childId === child?.childId} onClick={() => setSelectedId(each.childId)} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${each.childId === child?.childId ? "border-[#111111] bg-[#111111] text-white" : "border-[#e7e7e5] text-[#393a36]"}`}>
                  {each.name}
                </button>
              ))}
            </div>
          )}
          {safetyState?.riskLevel === "HIGH_RISK" && (
            <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[#eadfd6] bg-[#f8f4ef] px-4 py-3 text-[#9a4c35]">
              <p className="font-semibold">{safetyState.reasons[safetyState.reasons.length - 1]}</p><p className="shrink-0 text-sm font-medium">{formatDistance(safetyState.distanceToNearestZoneMeters)}</p>
            </div>
          )}
          <div className="h-[48vh] min-h-[340px] max-h-[520px] overflow-hidden rounded-[22px] border border-[#e7e7e5] bg-[#f1f1ee]">
            {location ? <LiveMap location={location} safeZones={zones} currentRoute={currentRoute} className="h-full rounded-none border-0" /> : (
              <div className="grid h-full place-items-center px-8 text-center text-sm leading-6 text-[#737373]"><MapMessage childList={children} selected={child} failed={failed} /></div>
            )}
          </div>
          {ageMs !== null && ageMs > STALE_MS && (
            <p role="status" className="mt-2 px-1 text-[12px] leading-5 text-[#b7791f]">Сүүлд {formatAge(ageMs)} шинэчлэгдсэн. Хүүхдийн утсан дээр SafePath нээлттэй эсэхийг шалгана уу.</p>
          )}
          {child && zones.length === 0 && (
            <p role="status" className="mt-2 px-1 text-[12px] leading-5 text-[#b7791f]">
              Аюулгүй бүс тохируулаагүй тул эрсдэлийг тооцохгүй байна. <Link href="/guardian/zones" className="font-medium text-[#111111] underline underline-offset-4">Бүс нэмэх</Link>
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-[#737373]" aria-label="Газрын зургийн тэмдэглэгээ">
            <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#111111]" />Одоогийн байршил</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#2e7d4f]" />Одоогийн зам</span>
            <Link href="/guardian/zones" className="ml-auto inline-flex min-h-8 items-center font-medium text-[#111111] underline underline-offset-4">Бүс засах</Link>
          </div>

        <section className="px-5 pt-4" aria-label="Одоогийн мэдээлэл">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-y border-[#e7e7e5] py-3">
            <Info label="Одоогийн байршил" value={safetyState ? (safetyState.isInsideSafeZone ? safetyState.nearestSafeZone.name : "Бүсээс гадуур") : "Тодорхойгүй"} />
            <Info label="Ойрын бүс" value={safetyState ? (safetyState.isInsideSafeZone ? "Дотор" : `${safetyState.nearestSafeZone.name} · ${formatDistance(safetyState.distanceToNearestZoneMeters)}`) : "—"} />
            <Info label="Сүүлийн шинэчлэл" value={ageMs !== null ? formatAge(ageMs) : "Хүлээгдэж байна"} />
            <Info label="Эрсдэл" value={safetyState ? `${safetyState.riskScore} / 100` : "— / 100"} />
          </dl>
        </section>

        <section id="events" className="px-5 pt-5">
          <h2 className="text-[16px] font-semibold">Өнөөдрийн үйл явдал</h2>
          <ol className="mt-3 grid grid-cols-3 gap-2">
            {timeline.map((event) => <li key={event.time} className="border-l-2 border-[#e7e7e5] pl-2.5">
              <time className="text-xs tabular-nums text-[#737373]">{event.time}</time>
              <p className="mt-1 text-[13px] leading-5">{event.label}</p>
            </li>)}
          </ol>
        </section>

        <nav aria-label="Асран хамгаалагчийн цэс" className="fixed inset-x-0 bottom-[78px] z-10 mx-auto flex w-full max-w-[430px] justify-around border-t border-[#e7e7e5] bg-white/95 px-2 py-2 backdrop-blur">
          {[["Хүмүүс", "/guardian/link"], ["Газрын зураг", "#location"], ["Мэдэгдэл", "#events"], ["Тохиргоо", "/settings"]].map(([label, href]) => <Link key={label} href={href} className={`rounded-lg px-2 py-2 text-xs ${label === "Газрын зураг" ? "font-semibold text-[#111111]" : "text-[#737373]"}`}>{label}</Link>)}
        </nav>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] border-t border-[#e7e7e5] bg-white px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        <div className="grid grid-cols-2 gap-2">
          <a href="tel:+97600000000" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#111111] text-[15px] font-medium text-white"><PhoneIcon />Залгах</a>
          <a href="#location" className="inline-flex min-h-[50px] items-center justify-center rounded-2xl border border-[#e7e7e5] text-[15px] font-medium">Байршил</a>
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
      className="fixed inset-x-0 bottom-[calc(74px+env(safe-area-inset-bottom))] z-20 mx-auto w-full max-w-[430px] border-t border-[rgba(79,143,168,0.15)] bg-black/85 backdrop-blur-xl"
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
                className="group flex h-[60px] flex-col items-center justify-center gap-1 select-none [-webkit-tap-highlight-color:transparent]"
              >
                <span
                  className={`relative grid h-8 w-14 place-items-center rounded-full transition-all duration-200 group-active:scale-90 ${
                    isActive
                      ? "bg-[var(--sp-primary-soft)] text-[var(--sp-primary)]"
                      : "text-[var(--sp-muted)]"
                  }`}
                >
                  {tab.icon(isActive)}
                  {tab.id === "alerts" && alert && (
                    <span className="absolute right-3 top-1 size-2 rounded-full bg-[var(--sp-risk)] ring-2 ring-black" />
                  )}
                </span>
                <span
                  className={`text-[11px] leading-none transition-colors ${
                    isActive
                      ? "font-semibold text-[var(--sp-primary)]"
                      : "text-[var(--sp-muted)]"
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
      className="size-[22px]"
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

function PeopleIcon({filled}: {filled: boolean}) {
  return (
    <IconBase filled={filled}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5v.5h-13z" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M17 14.2c2.6.2 4.5 2 4.5 4.8v1h-4" />
    </IconBase>
  );
}

function MapIcon({filled}: {filled: boolean}) {
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

function BellIcon({filled}: {filled: boolean}) {
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

function GearIcon({filled}: {filled: boolean}) {
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

function Legend({dot, label}: {dot: string; label: string}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function Info({label, value}: {label: string; value: string}) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-[var(--sp-muted)]">{label}</dt>
      <dd className="mt-0.5 truncate text-[14px] font-medium">{value}</dd>
    </div>
  );
}

/** What the map area says when there is no position to draw. */
function MapMessage({ childList, selected, failed }: { childList: ChildLocation[] | null; selected: ChildLocation | null; failed: boolean }) {
  if (!childList) return <p>{failed ? "Байршил ачаалж чадсангүй. Дахин оролдож байна…" : "Хүүхдийн байршлыг ачаалж байна…"}</p>;
  if (selected?.paused) return <p>Хүүхэд байршил хуваалцахаа түр зогсоосон байна.</p>;
  if (childList.length === 0) {
    return (
      <div>
        <p>Одоогоор хүүхэд холбогдоогүй байна.</p>
        <Link href="/guardian/link" className="mt-2 inline-flex min-h-11 items-center font-medium text-[#111111] underline underline-offset-4">Хүүхэд холбох</Link>
      </div>
    );
  }
  return <p>Хүүхдийн байршил хараахан ирээгүй байна. Хүүхдийн утсан дээр SafePath нээлттэй байх хэрэгтэй.</p>;
}

function formatAge(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 5) return "дөнгөж сая";
  if (seconds < 60) return `${seconds} секундийн өмнө`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} минутын өмнө`;
  return `${Math.round(minutes / 60)} цагийн өмнө`;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} м` : `${(meters / 1000).toFixed(1)} км`;
}
