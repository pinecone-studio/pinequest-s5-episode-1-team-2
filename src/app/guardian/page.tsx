"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { AppShell, PhoneIcon, StatusIndicator } from "@/components/safe-path";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { useGeolocation } from "@/hooks/use-geolocation";
import { calculateSafetyState } from "@/lib/risk-engine";
import { SAFE_ZONES } from "@/lib/safe-zones";

const LiveMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[320px] place-items-center text-sm text-[#737373]">Газрын зураг ачаалж байна…</div>,
});

const timeline = [
  { time: "08:05", label: "Гэрээс гарсан" },
  { time: "08:24", label: "Сургуульд ирсэн" },
  { time: "16:10", label: "Сургуулиас гарсан" },
];

export default function GuardianPage() {
  const { location, status: locationStatus, error } = useGeolocation();
  const { settings } = useAssistantSettings();
  const safetyState = useMemo(() => location ? calculateSafetyState({ location }) : null, [location]);
  const currentRoute: [number, number][] = location && safetyState
    ? [[location.latitude, location.longitude], [safetyState.nearestSafeZone.latitude, safetyState.nearestSafeZone.longitude]]
    : [];
  const familiarRoute: [number, number][] = [
    [SAFE_ZONES[0].latitude, SAFE_ZONES[0].longitude],
    [47.9212, 106.9176],
    [SAFE_ZONES[1].latitude, SAFE_ZONES[1].longitude],
  ];

  return (
    <AppShell>
      <main className="min-h-dvh pb-[calc(124px+env(safe-area-inset-bottom))]">
        <header className="flex min-h-[68px] items-center justify-between gap-3 px-5 pt-[env(safe-area-inset-top)]">
          <div className="min-w-0">
            <Link href="/" className="text-[17px] font-semibold tracking-[-0.025em]">SafePath</Link>
            <p className="mt-0.5 truncate text-sm text-[#737373]">{settings.userName || "Тэмүүлэн"}</p>
          </div>
          <StatusIndicator status={safetyState?.riskLevel ?? "SAFE"} />
        </header>

        <div id="location" className="px-4 pt-1">
          {safetyState?.riskLevel === "HIGH_RISK" && (
            <div role="alert" className="mb-3 flex items-center justify-between rounded-2xl border border-[#eadfd6] bg-[#f8f4ef] px-4 py-3 text-[#9a4c35]">
              <p className="font-semibold">Маршрутаас хазайсан байна</p><p className="text-sm font-medium">620 м</p>
            </div>
          )}
          <div className="h-[48vh] min-h-[340px] max-h-[520px] overflow-hidden rounded-[22px] border border-[#e7e7e5] bg-[#f1f1ee]">
            {location ? <LiveMap location={location} safeZones={SAFE_ZONES} currentRoute={currentRoute} familiarRoute={familiarRoute} className="h-full rounded-none border-0" /> : (
              <div className="grid h-full place-items-center px-8 text-center text-sm leading-6 text-[#737373]">{locationStatus === "loading" ? "Одоогийн байршлыг тогтоож байна…" : error || "Байршил хараахан олдсонгүй"}</div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-[#737373]" aria-label="Газрын зургийн тэмдэглэгээ">
            <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#111111]" />Одоогийн байршил</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#2e7d4f]" />Одоогийн зам</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-0 w-4 border-t border-dashed border-[#737373]" />Танил зам</span>
          </div>
        </div>

        <section className="px-5 pt-4" aria-label="Одоогийн мэдээлэл">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-y border-[#e7e7e5] py-3">
            <Info label="Одоогийн байршил" value={safetyState?.nearestSafeZone.name ?? "Тодорхойгүй"} />
            <Info label="Сургууль" value={safetyState?.isInsideSafeZone && safetyState.nearestSafeZone.id === "school" ? "Ирсэн" : "Хуваарьт газар"} />
            <Info label="Сүүлийн шинэчлэл" value={location ? "10 секундийн өмнө" : "Хүлээгдэж байна"} />
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
          {[["Хүмүүс", "/guardian"], ["Газрын зураг", "#location"], ["Мэдэгдэл", "#events"], ["Тохиргоо", "/settings"]].map(([label, href]) => <Link key={label} href={href} className={`rounded-lg px-2 py-2 text-xs ${label === "Газрын зураг" ? "font-semibold text-[#111111]" : "text-[#737373]"}`}>{label}</Link>)}
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
