"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AppShell, CompanionMark, StatusIndicator } from "@/components/safe-path";
import { useGeolocation } from "@/hooks/use-geolocation";
import { DEMO_SAFETY_SCENARIOS, getDemoSafetyLocation, isDemoRouteDeviation } from "@/lib/demo-simulation";
import { calculateSafetyState } from "@/lib/risk-engine";
import { SAFE_ZONES } from "@/lib/safe-zones";
import type { SafetyStatus } from "@/types/safety";
import type { DemoSafetyScenario } from "@/lib/demo-simulation";

const LiveMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => <MapMessage>Газрын зураг ачаалж байна…</MapMessage>,
});

type DemoSelection = "live" | DemoSafetyScenario;

const statusColor: Record<SafetyStatus, string> = {
  SAFE: "text-[#238636]",
  WARNING: "text-[#b26a00]",
  HIGH_RISK: "text-[#d1242f]",
};

export default function TrackerPage() {
  const { location, status: locationStatus, error } = useGeolocation();
  const [demoSelection, setDemoSelection] = useState<DemoSelection>("live");
  const isDevelopment = process.env.NODE_ENV === "development";
  const simulatedLocation = useMemo(
    () => (demoSelection === "live" ? null : getDemoSafetyLocation(demoSelection)),
    [demoSelection],
  );
  const currentLocation = simulatedLocation ?? location;
  const routeDeviation = demoSelection !== "live" && isDemoRouteDeviation(demoSelection);
  const safetyState = useMemo(
    () => currentLocation ? calculateSafetyState({ location: currentLocation, routeDeviation }) : null,
    [currentLocation, routeDeviation],
  );
  const status = safetyState?.riskLevel ?? "SAFE";

  return (
    <AppShell>
      <main className="flex min-h-dvh flex-col px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
        <header className="flex min-h-16 items-center justify-between px-1">
          <Link href="/" className="inline-flex min-h-11 items-center text-[17px] font-semibold tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">SafePath</Link>
          {safetyState && <StatusIndicator status={safetyState.riskLevel} />}
        </header>

        <section className="flex items-center gap-4 px-1 pb-5 pt-2">
          <CompanionMark />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#737373]">Мило</p>
            <h1 aria-live="polite" className={`mt-1 text-[26px] font-semibold tracking-[-0.035em] ${statusColor[status]}`}>
              {safetyState ? getStatusTitle(safetyState.riskLevel) : "БАЙРШИЛ"}
            </h1>
            <p className="mt-1 text-[15px] text-[#737373]">
              {safetyState ? getStatusDescription(safetyState) : "Байршил тогтоож байна…"}
            </p>
          </div>
        </section>

        {currentLocation ? (
          <LiveMap location={currentLocation} safeZones={SAFE_ZONES} className="min-h-[350px] flex-1" />
        ) : (
          <MapMessage>{locationStatus === "loading" ? "Байршил тогтоож байна…" : error}</MapMessage>
        )}

        {safetyState && currentLocation && (
          <section className="flex min-h-12 items-center justify-between gap-3 border-b border-[#e8e8e5] px-1 text-xs text-[#737373]" aria-label="Аюулгүй бүсийн мэдээлэл" aria-live="polite">
            <span className="truncate">
              {safetyState.isInsideSafeZone
                ? `${safetyState.nearestSafeZone.name} · Аюулгүй бүсэд байна`
                : `Ойр бүс: ${safetyState.nearestSafeZone.name} · ${safetyState.distanceToNearestZoneMeters} м`}
            </span>
            <span className="shrink-0">Эрсдэл {safetyState.riskScore}/100</span>
          </section>
        )}

        {currentLocation && (
          <div className="flex min-h-9 items-center justify-between gap-3 px-1 pt-2 text-xs text-[#737373]" aria-live="polite">
            <span>{simulatedLocation ? "Demo байршил" : "Байршил шинэчлэгдсэн"}</span>
            <time>{formatUpdatedTime(currentLocation.lastUpdated)}</time>
          </div>
        )}

        {currentLocation && error && !simulatedLocation && <p className="px-1 pb-1 text-xs leading-5 text-[#d1242f]">{error}</p>}

        {isDevelopment && (
          <label className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-[#e8e8e5] px-1 pt-2 text-xs text-[#737373]">
            <span className="shrink-0 font-medium">DEMO</span>
            <select
              value={demoSelection}
              onChange={(event) => setDemoSelection(event.target.value as DemoSelection)}
              aria-label="Demo аюулгүй байдлын төлөв"
              className="min-h-10 max-w-[250px] rounded-xl border border-[#deded9] bg-white px-3 text-sm text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
            >
              <option value="live">Бодит GPS</option>
              {(Object.entries(DEMO_SAFETY_SCENARIOS) as [DemoSafetyScenario, (typeof DEMO_SAFETY_SCENARIOS)[DemoSafetyScenario]][]).map(([scenario, definition]) => (
                <option key={scenario} value={scenario}>{definition.label}</option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-2 pt-3">
          <button type="button" className="min-h-13 rounded-2xl bg-[#111111] px-4 text-[15px] font-semibold text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">Дахин хэлэх</button>
          <Link href="/guardian" className="inline-flex min-h-13 items-center justify-center rounded-2xl bg-[#f6f6f4] px-3 text-center text-[15px] font-semibold hover:bg-[#ededeb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">Асран хамгаалагч</Link>
        </div>

        <button type="button" className="mx-auto mt-2 min-h-11 px-4 text-[15px] font-semibold text-[#d1242f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1242f]">Тусламж</button>
      </main>
    </AppShell>
  );
}

function getStatusTitle(status: SafetyStatus) {
  if (status === "HIGH_RISK") return "ӨНДӨР ЭРСДЭЛ";
  if (status === "WARNING") return "АНХААР";
  return "АЮУЛГҮЙ";
}

function getStatusDescription(state: NonNullable<ReturnType<typeof calculateSafetyState>>) {
  if (state.riskLevel === "HIGH_RISK") return "Аюулгүй бүсээс хэт холдсон байна.";
  if (state.isInsideSafeZone) return `${state.nearestSafeZone.name} аюулгүй бүсэд байна.`;
  if (state.routeDeviation) return "Маршрутаас хазайсан байна.";
  return `Аюулгүй бүсээс ${state.distanceToNearestZoneMeters} м хол байна.`;
}

function MapMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[350px] flex-1 flex-col items-center justify-center rounded-[24px] border border-[#e8e8e5] bg-[#f6f6f4] px-8 text-center text-[15px] leading-6 text-[#737373]">
      {children}
    </div>
  );
}

function formatUpdatedTime(timestamp: number) {
  return new Intl.DateTimeFormat("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}
