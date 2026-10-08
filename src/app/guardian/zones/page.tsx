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
        <div className="px-5 pt-2">
          {!selected ? (
            <div className="pt-6 text-[14px] text-[#737373]">
              <p>Эхлээд хүүхдээ холбоно уу.</p>
              <Link href="/guardian/link" className="mt-2 inline-flex min-h-11 items-center font-medium text-[#111111] underline underline-offset-4">Хүүхэд холбох</Link>
            </div>
          ) : (
            <>
              {children.length > 1 && (
                <nav className="mb-3 flex gap-2 overflow-x-auto" aria-label="Хүүхэд сонгох">
                  {children.map((child) => (
                    <Link
                      key={child.childId}
                      href={`/guardian/zones?child=${child.childId}`}
                      aria-current={child.childId === selected.childId ? "page" : undefined}
                      className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${child.childId === selected.childId ? "border-[#111111] bg-[#111111] text-white" : "border-[#e7e7e5] text-[#393a36]"}`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </nav>
              )}
              <p className="mb-3 text-[14px] leading-6 text-[#737373]">{selected.name} эдгээр бүсийн гадна гарвал эрсдэл нэмэгдэнэ.</p>
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
