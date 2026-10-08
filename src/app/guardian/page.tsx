"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PhoneIcon, StatusIndicator } from "@/components/safe-path";
import { useChildLocations } from "@/hooks/use-child-locations";
import { calculateSafetyState } from "@/lib/risk-engine";
import type { ChildLocation } from "@/types/location";
import type { SafeZone, SafetyLocation } from "@/types/safety";

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
