import Link from "next/link";
import {ChevronLeft} from "lucide-react";
import {AppShell, BackHeader} from "@/components/safe-path";
import {ZoneEditor} from "@/components/zone-editor";
import {requireRole} from "@/lib/auth/dal";
import {listChildLocations} from "@/lib/location-sharing";

export default async function ZonesPage({
  searchParams,
}: {
  searchParams: Promise<{child?: string | string[]}>;
}) {
  const guardian = await requireRole("guardian");
  const children = await listChildLocations(guardian.id);
  const {child: wanted} = await searchParams;
  const selected =
    children.find((child) => child.childId === wanted) ?? children[0];

  return (
    <AppShell className="!max-w-none">
      <main
        className="relative isolate min-h-dvh overflow-hidden px-4 pb-[calc(100px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] text-[#f0f6f1] sm:px-5 sm:pt-[calc(20px+env(safe-area-inset-top))]"
        style={{
          background:
            "linear-gradient(155deg, #05090d 0%, #07151b 52%, #03080c 100%)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-6rem] top-[12%] size-72 rounded-full bg-[#06b6d4]/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-[#0e7490]/30 blur-3xl"
        />

        <div className="relative z-10 mx-auto w-full max-w-[1180px]">
          <header className="relative z-10 mx-auto flex h-14 w-full max-w-[390px] items-center gap-2.5 border-b border-white/15 sm:max-w-full">
            <Link
              href="/guardian"
              aria-label="Өмнөх хуудас руу буцах"
              className="grid size-10 shrink-0 place-items-center rounded-xl text-[#d8e8eb] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </Link>
            <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.3)]">
              <svg
                viewBox="0 0 24 24"
                className="size-[22px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <path
                  d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="10" r="2.5" fill="currentColor" />
              </svg>
            </span>
            <span className="text-[18px] font-bold tracking-[-0.04em] text-white">
              SafePath
            </span>
            <span className="ml-auto inline-flex items-center justify-center rounded-full border border-cyan-200/40 px-3 py-1.5 text-sm text-cyan-200">
              Аюулгүй бүс
            </span>
          </header>

          <div className="mx-auto max-w-[390px] px-0 pt-5 sm:max-w-full sm:px-8">
            {!selected ? (
              <div className="mt-6 rounded-3xl border border-[#22d3ee]/25 bg-[#0b1b20]/85 p-6 backdrop-blur-md sm:p-8">
                <p className="text-lg font-semibold tracking-tight text-white">
                  Хүүхдийн байршлыг харахын тулд эхлээд холбоно уу.
                </p>
                <p className="mt-2 text-sm leading-6 text-[#9fb4bb]">
                  Холбосны дараа аюулгүй бүс үүсгэж, газрын зураг дээр харах
                  боломжтой.
                </p>
                <Link
                  href="/guardian/link"
                  className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#0891b2] px-5 text-sm font-semibold text-[#06212a] shadow-[0_4px_14px_rgba(6,182,212,0.4)] transition hover:brightness-110"
                >
                  Хүүхэд холбох
                </Link>
              </div>
            ) : (
              <>
                {children.length > 1 && (
                  <nav
                    className="mb-5 flex gap-2 overflow-x-auto pb-1"
                    aria-label="Хүүхэд сонгох"
                  >
                    {children.map((child) => {
                      const isSelected = child.childId === selected.childId;
                      return (
                        <Link
                          key={child.childId}
                          href={`/guardian/zones?child=${child.childId}`}
                          aria-current={isSelected ? "page" : undefined}
                          className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-5 text-sm font-medium transition-colors ${
                            isSelected
                              ? "border-[#67e8f9] bg-[#0e7490] text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                              : "border-white/15 bg-[#0b1b20]/60 text-[#c2d0d5] hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {child.name}
                        </Link>
                      );
                    })}
                  </nav>
                )}

                <section className="mb-6 rounded-2xl border border-[#22d3ee]/20 bg-[#0b1b20]/80 px-5 py-4 backdrop-blur-md sm:px-6">
                  <p className="text-sm font-semibold text-white">
                    {selected.name}-ийн аюулгүй бүсүүд
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#9fb4bb]">
                    Гэр, сургууль зэрэг газрыг тэмдэглэж, хүүхдийн байршлыг
                    бүсүүдтэй харьцуулан хянаарай.
                  </p>
                </section>

                <div className="overflow-hidden rounded-3xl border border-[#22d3ee]/25 bg-[#0b1b20]/90 p-1 backdrop-blur-xl">
                  <ZoneEditor
                    key={selected.childId}
                    childId={selected.childId}
                    zones={selected.zones}
                    childPosition={
                      selected.position && {
                        latitude: selected.position.latitude,
                        longitude: selected.position.longitude,
                      }
                    }
                  />
                </div>
              </>
            )}
          </div>
import { ChildTabs, GuardianScreen } from "@/components/guardian-screen";
import { ZoneEditor } from "@/components/zone-editor";
import { requireRole } from "@/lib/auth/dal";
import { listChildLocations } from "@/lib/location-sharing";

/** A point passed in the address (from a tap on the guardian's home map), if it is a real coordinate. */
function pointFrom(lat?: string | string[], lng?: string | string[]) {
  const latitude = Number(Array.isArray(lat) ? lat[0] : lat);
  const longitude = Number(Array.isArray(lng) ? lng[0] : lng);
  if (!lat || !lng || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export default async function ZonesPage({ searchParams }: { searchParams: Promise<{ child?: string | string[]; lat?: string | string[]; lng?: string | string[] }> }) {
  const guardian = await requireRole("guardian");
  const children = await listChildLocations(guardian.id);
  const { child: wanted, lat, lng } = await searchParams;
  const initialPoint = pointFrom(lat, lng);
  const selected = children.find((child) => child.childId === wanted) ?? children[0];

  return (
    <GuardianScreen title="Аюулгүй бүс">
      {!selected ? (
        <div className="rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-5">
          <p className="text-base font-semibold">Аюулгүй бүс үүсгэхийн тулд эхлээд хүүхдээ холбоно уу.</p>
          <Link href="/guardian/link" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-(--sp-primary) px-5 text-sm font-semibold text-white">Хүүхэд холбох</Link>
        </div>
      ) : (
        <>
          <ChildTabs items={children} selectedId={selected.childId} hrefFor={(childId) => `/guardian/zones?child=${childId}`} />
          <ZoneEditor
            key={selected.childId}
            childId={selected.childId}
            childName={selected.name}
            zones={selected.zones}
            initialPoint={initialPoint}
            childPosition={selected.position && { latitude: selected.position.latitude, longitude: selected.position.longitude }}
          />
        </>
      )}
    </GuardianScreen>
  );
}
