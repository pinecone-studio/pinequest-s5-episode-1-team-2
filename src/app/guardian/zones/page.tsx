import Link from "next/link";
import { AppShell, BackHeader } from "@/components/safe-path";
import { ZoneEditor } from "@/components/zone-editor";
import { requireRole } from "@/lib/auth/dal";
import { listChildLocations } from "@/lib/location-sharing";

export default async function ZonesPage({ searchParams }: { searchParams: Promise<{ child?: string | string[] }> }) {
  const guardian = await requireRole("guardian");
  const children = await listChildLocations(guardian.id);
  const { child: wanted } = await searchParams;
  const selected = children.find((child) => child.childId === wanted) ?? children[0];

  return (
    <AppShell>
      <main className="min-h-dvh pb-[calc(24px+env(safe-area-inset-bottom))]">
        <BackHeader title="Аюулгүй бүс" />
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-3 sm:px-6 lg:px-8">
          {!selected ? (
            <div className="mt-4 rounded-3xl border border-[#e7e7e5] bg-white p-6 sm:p-8">
              <p className="text-base font-semibold text-[#20211f]">Эхлээд хүүхдээ холбоно уу.</p>
              <p className="mt-1 text-sm leading-6 text-[#737373]">Хүүхдээ холбосны дараа аюулгүй бүс нэмэх боломжтой.</p>
              <Link href="/guardian/link" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#111111] px-5 text-sm font-semibold text-white">Хүүхэд холбох</Link>
            </div>
          ) : (
            <>
              {children.length > 1 && (
                <nav className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Хүүхэд сонгох">
                  {children.map((child) => (
                    <Link
                      key={child.childId}
                      href={`/guardian/zones?child=${child.childId}`}
                      aria-current={child.childId === selected.childId ? "page" : undefined}
                      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${child.childId === selected.childId ? "border-[#111111] bg-[#111111] text-white" : "border-[#e7e7e5] bg-white text-[#393a36] hover:border-[#a7a7a2]"}`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </nav>
              )}
              <div className="mb-5">
                <p className="text-sm leading-6 text-[#737373]">{selected.name}-д зориулсан аюулгүй бүсүүдээ газрын зураг дээр тохируулна уу.</p>
              </div>
              <ZoneEditor
                key={selected.childId}
                childId={selected.childId}
                zones={selected.zones}
                childPosition={selected.position && { latitude: selected.position.latitude, longitude: selected.position.longitude }}
              />
            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}
