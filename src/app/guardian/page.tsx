"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {useEffect, useMemo, useState} from "react";
import {AppShell, PhoneIcon, StatusIndicator} from "@/components/safe-path";
import {useAssistantSettings} from "@/hooks/use-assistant-settings";
import {useGeolocation} from "@/hooks/use-geolocation";
import {calculateSafetyState} from "@/lib/risk-engine";
import {SAFE_ZONES} from "@/lib/safe-zones";

const LiveMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[320px] place-items-center text-sm text-[#737373]">Газрын зураг ачаалж байна…</div>,
});

const timeline = [
  { time: "08:05", label: "Гэрээс гарсан" },
  { time: "08:24", label: "Сургуульд ирсэн" },
  { time: "16:10", label: "Сургуулиас гарсан" },
];

/** A position older than this is flagged as out of date. */
const STALE_MS = 2 * 60_000;

export default function GuardianPage() {
  const {location, status: locationStatus, error} = useGeolocation();
  const {settings} = useAssistantSettings();
  const now = useNow();
  const [mapKey, setMapKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>("map");

  const childName = settings.userName || "Тэмүүлэн";
  const phone = (settings as {emergencyPhone?: string}).emergencyPhone ?? "";

  const loc = location as
    | (typeof location & {timestamp?: number; accuracy?: number})
    | null;

  const [prevLocation, setPrevLocation] = useState(location);
  const [lastUpdate, setLastUpdate] = useState<number | null>(
    loc ? loc.timestamp ?? now : null
  );
  if (location !== prevLocation) {
    setPrevLocation(location);
    setLastUpdate(loc ? loc.timestamp ?? now : null);
  }

  const safetyState = useMemo(
    () => (location ? calculateSafetyState({location}) : null),
    [location]
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
    ? error ?? "Түр хүлээнэ үү"
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
        className="min-h-dvh bg-[linear-gradient(180deg,var(--sp-bg-top)_0%,var(--sp-bg-bottom)_45%,var(--sp-bg-bottom)_100%)] text-[var(--sp-ink)]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 mx-auto h-56 max-w-[430px] bg-[radial-gradient(60%_80%_at_80%_0%,rgba(79,143,168,0.22),transparent_70%)]"
        />
        <main className="relative min-h-dvh pb-[calc(150px+env(safe-area-inset-bottom))]">
          <header className="flex min-h-[64px] items-center justify-between gap-3 px-5 pt-[env(safe-area-inset-top)]">
            <div className="min-w-0">
              <Link
                href="/"
                className="text-[17px] font-semibold tracking-[-0.025em]"
              >
                SafePath
              </Link>
              <p className="mt-0.5 truncate text-sm text-[var(--sp-muted)]">
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
            <p className="mt-1 pl-[18px] text-sm text-[var(--sp-muted)]">
              {subline} · {formatRelative(lastUpdate, now)}
            </p>
          </section>

          <div id="location" className="px-4">
            <div className="relative h-[46vh] min-h-[320px] max-h-[500px] overflow-hidden rounded-[22px] border border-[var(--sp-line)] bg-[var(--sp-surface)]">
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
                    <span className="absolute left-3 top-3 z-[400] rounded-full border border-[var(--sp-line)] bg-black/75 px-2.5 py-1 text-[11px] text-[var(--sp-muted)] shadow-sm backdrop-blur">
                      ±{Math.round(loc.accuracy)} м
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setMapKey((k) => k + 1)}
                    aria-label="Одоогийн байршил руу буцах"
                    className="absolute right-3 top-3 z-[400] grid size-10 place-items-center rounded-full border border-[var(--sp-line)] bg-black/80 text-[var(--sp-primary)] shadow-sm"
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
                    className="absolute bottom-3 left-3 z-[400] flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-[var(--sp-line)] bg-black/75 px-3 py-2 text-[11px] text-[var(--sp-muted)] shadow-sm backdrop-blur"
                  >
                    <Legend dot="bg-[var(--sp-primary)]" label="Байршил" />
                    <Legend
                      dot="bg-[var(--sp-secondary)]"
                      label="Одоогийн зам"
                    />
                    <span className="inline-flex items-center gap-1.5">
                      <i className="h-0 w-4 border-t border-dashed border-[var(--sp-muted)]" />
                      Танил зам
                    </span>
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center px-8 text-center text-sm leading-6 text-[var(--sp-muted)]">
                  {locationStatus === "loading"
                    ? "Одоогийн байршлыг тогтоож байна…"
                    : error || "Байршил хараахан олдсонгүй"}
                </div>
              )}
            </div>
          </div>

          <section className="px-5 pt-4" aria-label="Одоогийн мэдээлэл">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-y border-[var(--sp-line)] py-3">
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
                <dt className="text-[12px] text-[var(--sp-muted)]">Эрсдэл</dt>
                <dd className="mt-1 flex items-center gap-3">
                  <span
                    className={`text-[14px] font-medium ${TONE[tone].text}`}
                  >
                    {safetyState ? TONE[tone].label : "—"}
                  </span>
                  <span
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--sp-line)]"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={safetyState?.riskScore ?? 0}
                    aria-label="Эрсдэлийн оноо"
                  >
                    <span
                      className={`block h-full rounded-full transition-all ${TONE[tone].bar}`}
                      style={{width: `${safetyState?.riskScore ?? 0}%`}}
                    />
                  </span>
                </dd>
              </div>
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

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[12px] text-[#737373]">{label}</dt><dd className="mt-0.5 truncate text-[14px] font-medium">{value}</dd></div>;
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
