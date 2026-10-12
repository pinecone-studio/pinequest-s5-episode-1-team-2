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
    <AppShell className="!max-w-none">
      <main className="min-h-dvh pb-[calc(32px+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[1180px]">
          <BackHeader title="Аюулгүй бүс" />
        <div className="px-5 pt-2 sm:px-8 lg:pt-5">
          {!selected ? (
            <div className="mt-6 rounded-3xl border border-[#e9e9e5] bg-[#fafaf8] p-6 sm:p-8">
              <p className="text-lg font-semibold tracking-tight">Хүүхдийн байршлыг харахын тулд эхлээд холбоно уу.</p>
              <p className="mt-2 text-sm leading-6 text-[#737373]">Холбосны дараа аюулгүй бүс үүсгэж, газрын зураг дээр харах боломжтой.</p>
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
                      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-5 text-sm font-medium transition-colors ${child.childId === selected.childId ? "border-[#111111] bg-[#111111] text-white" : "border-[#e7e7e5] bg-white text-[#393a36] hover:bg-[#f7f7f5]"}`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </nav>
              )}
              <section className="mb-6 rounded-2xl bg-[#f7f7f5] px-5 py-4 sm:px-6">
                <p className="text-sm font-semibold text-[#252622]">{selected.name}-ийн аюулгүй бүсүүд</p>
                <p className="mt-1 text-sm leading-6 text-[#737373]">Гэр, сургууль зэрэг газрыг тэмдэглэж, хүүхдийн байршлыг бүсүүдтэй харьцуулан хянаарай.</p>
              </section>
              <ZoneEditor
                key={selected.childId}
                childId={selected.childId}
                zones={selected.zones}
                childPosition={selected.position && { latitude: selected.position.latitude, longitude: selected.position.longitude }}
              />
            </>
          )}
        </div>
        </div>
      </main>
    </AppShell>
  );
}
