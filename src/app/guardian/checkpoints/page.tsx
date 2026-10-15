import Link from "next/link";
import { AppShell, BackHeader } from "@/components/safe-path";
import { CheckpointEditor } from "@/components/checkpoint-editor";
import { requireRole } from "@/lib/auth/dal";
import { listCheckpoints } from "@/lib/checkpoints";
import { listChildLocations } from "@/lib/location-sharing";

export default async function CheckpointsPage({ searchParams }: { searchParams: Promise<{ child?: string | string[] }> }) {
  const guardian = await requireRole("guardian");
  const children = await listChildLocations(guardian.id);
  const { child: wanted } = await searchParams;
  const selected = children.find((child) => child.childId === wanted) ?? children[0];
  const checkpoints = selected ? await listCheckpoints(selected.childId) : [];

  return (
    <AppShell className="!max-w-none">
      <main className="min-h-dvh pb-[calc(32px+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[1180px]">
          <BackHeader title="Шалгах цэг" />
          <div className="px-5 pt-2 sm:px-8 lg:pt-5">
            {!selected ? (
              <div className="mt-6 rounded-3xl border border-[#e9e9e5] bg-[#fafaf8] p-6 sm:p-8">
                <p className="text-lg font-semibold tracking-tight">Шалгах цэг өгөхийн тулд эхлээд хүүхдээ холбоно уу.</p>
                <Link href="/guardian/link" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#111111] px-5 text-sm font-semibold text-white">Хүүхэд холбох</Link>
              </div>
            ) : (
              <>
                {children.length > 1 && (
                  <nav className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Хүүхэд сонгох">
                    {children.map((child) => (
                      <Link
                        key={child.childId}
                        href={`/guardian/checkpoints?child=${child.childId}`}
                        aria-current={child.childId === selected.childId ? "page" : undefined}
                        className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-5 text-sm font-medium transition-colors ${child.childId === selected.childId ? "border-[#111111] bg-[#111111] text-white" : "border-[#e7e7e5] bg-white text-[#393a36] hover:bg-[#f7f7f5]"}`}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </nav>
                )}
                <section className="mb-6 rounded-2xl bg-[#f4f1ff] px-5 py-4 sm:px-6">
                  <p className="text-sm font-semibold text-[#3b2a6b]">🎯 Зорилго өгөх: {selected.name}</p>
                  <p className="mt-1 text-sm leading-6 text-[#5b5470]">Сургууль, номын сан зэрэг газрыг сонгоод шагнал тавина. {selected.name} тэнд GPS-ээр үнэхээр хүрч очвол шинэ найз эсвэл чимэглэл автоматаар нээгдэнэ.</p>
                </section>
                <CheckpointEditor
                  key={selected.childId}
                  childId={selected.childId}
                  childName={selected.name}
                  zones={selected.zones}
                  checkpoints={checkpoints}
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
