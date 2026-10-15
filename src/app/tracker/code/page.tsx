import Link from "next/link";
import { ChevronLeft, LogOut, MapPin, Shield, UserX } from "lucide-react";
import { logout, unlink } from "@/app/actions/auth";
import { CodeGenerator } from "@/components/auth/pairing";
import { AppShell } from "@/components/safe-path";
import { requireRole } from "@/lib/auth/dal";
import { listLinkedPeople } from "@/lib/auth/pairing";

export default async function TrackerCodePage() {
  const child = await requireRole("child");
  const guardians = await listLinkedPeople(child.id, "child");

  return (
    <AppShell>
      <main
        className="relative isolate min-h-dvh w-full overflow-x-hidden px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] text-[#f0f6f1] sm:px-6"
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

        <div className="mx-auto w-full max-w-[420px]">

          <header className="relative z-10 flex h-14 w-full items-center gap-2.5">
            <Link
              href="/tracker"
              aria-label="Хянах хуудас руу буцах"
              className="grid size-10 shrink-0 place-items-center rounded-xl text-[#d8e8eb] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </Link>
            <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.3)]">
              <MapPin size={22} fill="currentColor" strokeWidth={2.2} />
            </span>
            <span className="text-[18px] font-bold tracking-[-0.04em]">
              SafePath
            </span>
            <span className="ml-auto inline-flex items-center justify-center rounded-full border border-cyan-200/40 px-3 py-1.5 text-sm text-cyan-200">
              Холбох код
            </span>
          </header>

          <div className="relative z-10 pt-4">

            <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/10 bg-cyan-500/5 py-2.5 text-center">
              <Shield size={16} className="text-[#67e8f9]" />
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#67e8f9]">
                Аюулгүй байдлын тохиргоо
              </p>
            </div>


            <section
              aria-label="Холбох код авах"
              className="rounded-[24px] border border-[#67e8f9]/20 bg-[#0b1b21]/90 p-5 shadow-[0_18px_45px_rgba(0,0,0,.22)] backdrop-blur-md"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0e7490]/35 text-[#67e8f9]">
                  <MapPin size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-[16px] font-semibold text-white">
                    Таны холбох код
                  </h2>
                  <p className="mt-0.5 text-xs text-[#9fb4bb]">
                    Эцэг эхтэйгээ аюулгүй холбогдоно
                  </p>
                </div>
              </div>

              <div className="[&_form]:flex [&_form]:flex-col [&_form]:gap-3 [&_form>div]:rounded-2xl [&_form>div]:border [&_form>div]:border-[#67e8f9]/20 [&_form>div]:bg-[#071116] [&_form>div]:px-4 [&_form>div]:py-4 [&_form>div]:text-center [&_form>div]:text-white [&_form>div>p:first-child]:text-[32px] [&_form>div>p:first-child]:font-bold [&_form>div>p:first-child]:tracking-[0.25em] [&_form>div>p:last-child]:mt-1 [&_form>div>p:last-child]:text-[#b7c7cc] [&_button]:flex [&_button]:min-h-12 [&_button]:w-full [&_button]:items-center [&_button]:justify-center [&_button]:gap-2.5 [&_button]:rounded-2xl [&_button]:border [&_button]:border-[#22d3ee]/40 [&_button]:bg-[#0e7490]/30 [&_button]:px-5 [&_button]:text-[15px] [&_button]:font-semibold [&_button]:text-white [&_button]:shadow-[0_0_15px_-3px_rgba(14,116,144,0.3)] [&_button]:transition-all [&_button]:duration-200 [&_button:hover]:border-[#22d3ee]/80 [&_button:hover]:bg-[#0e7490]/60 [&_button:active]:scale-[0.98] [&_button:disabled]:opacity-50 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-[#67e8f9]">
                <CodeGenerator />
              </div>
            </section>


            <section className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-white">
                  Таныг харж буй хүмүүс
                </h2>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-[#67e8f9]">
                  {guardians.length}
                </span>
              </div>

              {guardians.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center">
                  <p className="text-[13px] leading-relaxed text-[#9fb4bb]">
                    Одоогоор хэн ч холбогдоогүй байна.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {guardians.map((guardian) => (
                    <li
                      key={guardian.linkId}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          aria-hidden="true"
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0e7490]/35 text-sm font-semibold text-[#67e8f9]"
                        >
                          {guardian.name?.[0] ?? "Э"}
                        </span>
                        <span className="text-[15px] font-medium text-white truncate">
                          {guardian.name}
                        </span>
                      </div>
                      <form action={unlink}>
                        <input
                          type="hidden"
                          name="linkId"
                          value={guardian.linkId}
                        />
                        <button
                          type="submit"
                          className="group inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300 transition hover:border-rose-500/60 hover:bg-rose-500/20 active:scale-95"
                        >
                          <UserX size={13} className="text-rose-400" />
                          <span>Салгах</span>
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>


            <form action={logout} className="mt-5">
              <button
                type="submit"
                className="group flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#22d3ee]/40 bg-[#0e7490]/30 px-5 text-[15px] font-semibold text-white shadow-[0_0_15px_-3px_rgba(14,116,144,0.3)] transition-all duration-200 hover:border-[#22d3ee]/80 hover:bg-[#0e7490]/60 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
              >
                <LogOut
                  className="size-4.5 text-[#67e8f9] transition-transform duration-200 group-hover:-translate-x-0.5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span>Гарах</span>
              </button>
            </form>
          </div>
        </div>
      </main>
    </AppShell>
  );
}