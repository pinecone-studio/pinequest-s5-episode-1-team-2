import { AppShell, BackHeader, LocationIcon, MockMap, PhoneIcon, StatusIndicator } from "@/components/safe-path";
import type { SafetyStatus } from "@/types/safety";

function getMockStatus(): SafetyStatus {
  return "SAFE";
}
const timeline = [
  { time: "08:05", label: "Гэрээс гарсан" },
  { time: "08:24", label: "Сургуульд ирсэн" },
  { time: "16:10", label: "Сургуулиас гарсан" },
];

export default function GuardianPage() {
  const status = getMockStatus();

  return (
    <AppShell>
      <main className="min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom))]">
        <BackHeader title="Тэмүүлэн" right={<StatusIndicator status={status} />} />

        <div id="location" className="px-4 pt-2">
          {status === "HIGH_RISK" && (
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-[#f1c7ca] bg-[#fff5f5] px-4 py-3 text-[#d1242f]">
              <p className="font-semibold">Маршрутаас хазайсан</p>
              <p className="text-sm font-medium">620 м</p>
            </div>
          )}
          <MockMap className="h-[390px]" />
        </div>

        <section className="px-6 py-7" aria-label="Одоогийн мэдээлэл">
          <dl className="divide-y divide-[#e8e8e5] border-y border-[#e8e8e5]">
            <InfoRow label="Одоогийн байршил" value="Сургууль" />
            <InfoRow label="Сүүлийн шинэчлэл" value="10 секундийн өмнө" />
            <InfoRow label="Эрсдэл" value="23 / 100" />
          </dl>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ededeb]" role="img" aria-label="Эрсдэлийн оноо 100-аас 23">
            <div className="h-full w-[23%] rounded-full bg-[#238636]" />
          </div>
        </section>

        <section className="px-6">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Өнөөдөр</h2>
          <ol className="mt-5">
            {timeline.map((event, index) => (
              <li key={event.time} className="relative grid grid-cols-[54px_18px_1fr] gap-2 pb-6 last:pb-0">
                <time className="pt-px text-sm tabular-nums text-[#737373]">{event.time}</time>
                <span className="relative flex justify-center">
                  <span className="mt-1 size-2.5 rounded-full border-2 border-[#111111] bg-white" aria-hidden="true" />
                  {index < timeline.length - 1 && <span className="absolute bottom-[-4px] top-3 w-px bg-[#deded9]" aria-hidden="true" />}
                </span>
                <p className="text-[15px] font-medium">{event.label}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[430px] border-t border-[#e8e8e5] bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        <div className="grid grid-cols-2 gap-2">
          <a href="tel:+97600000000" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"><PhoneIcon />Залгах</a>
          <a href="#location" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#f6f6f4] px-4 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"><LocationIcon />Байршил</a>
        </div>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 py-3">
      <dt className="text-[15px] text-[#737373]">{label}</dt>
      <dd className="text-right text-[15px] font-semibold">{value}</dd>
    </div>
  );
}
