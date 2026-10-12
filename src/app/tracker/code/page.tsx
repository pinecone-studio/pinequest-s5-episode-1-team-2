import Link from "next/link";
import { ChevronLeft, MapPin } from "lucide-react";
import { unlink } from "@/app/actions/auth";
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
        className="relative isolate min-h-dvh overflow-hidden px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] text-[#f0f6f1] sm:px-5 sm:pt-[calc(20px+env(safe-area-inset-top))]"
        style={{ background: "linear-gradient(155deg, #05090d 0%, #07151b 52%, #03080c 100%)" }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute right-[-6rem] top-[12%] size-72 rounded-full bg-[#06b6d4]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-[#0e7490]/30 blur-3xl" />

        <header className="relative z-10 mx-auto flex h-14 w-full max-w-[390px] items-center gap-2.5">
          <Link
            href="/tracker"
            aria-label="Хянах хуудас руу буцах"
            className="-ml-2 grid size-10 shrink-0 place-items-center rounded-[14px] text-[#c2d0d5] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </Link>
          <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.3)]">
            <MapPin size={22} fill="currentColor" strokeWidth={2.2} />
          </span>
          <span className="text-[18px] font-bold tracking-[-0.04em]">SafePath</span>
          <span className="ml-auto inline-flex items-center rounded-full border border-cyan-200 px-3 py-1.5 text-sm text-cyan-200">
            Холбох код
          </span>
        </header>

        <div className="relative z-10 mx-auto w-full max-w-[390px] pt-7">
          <div className="mb-7">
            <p className="mb-2 text-center pt-3 text-1xl font-semibold uppercase tracking-[0.16em] text-[#67e8f9]">Аюулгүй байдлын  
              тохиргоо</p>
            
           
          </div>
<div className="pt-10">
          <section aria-label="Холбох код авах" className="rounded-[24px] border border-[#67e8f9]/20 bg-[#0b1b21]/90 p-5 shadow-[0_18px_45px_rgba(0,0,0,.22)]">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0e7490]/35 text-[#67e8f9]">
                <MapPin size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[16px] font-semibold text-white">Таны холбох код</h2>
                <p className="mt-0.5 text-xs text-[#9fb4bb]">Эцэг эхтэйгээ аюулгүй холбогдоно</p>
              </div>
            </div>
            <div className="[&_form]:gap-3 [&_form>div]:rounded-2xl [&_form>div]:border [&_form>div]:border-[#67e8f9]/20 [&_form>div]:bg-[#071116] [&_form>div]:px-4 [&_form>div]:py-5 [&_form>div]:text-white [&_form>div>p:first-child]:text-[34px] [&_form>div>p:first-child]:font-bold [&_form>div>p:first-child]:tracking-[0.28em] [&_form>div>p:last-child]:mt-2 [&_form>div>p:last-child]:text-[#b7c7cc] [&_button]:min-h-14 [&_button]:rounded-2xl [&_button]:bg-gradient-to-r [&_button]:from-[#0e7490] [&_button]:to-[#0891b2] [&_button]:px-5 [&_button]:text-[15px] [&_button]:font-bold [&_button]:text-white [&_button]:shadow-[0_8px_22px_rgba(6,182,212,.18)] [&_button]:transition [&_button:hover]:brightness-110 [&_button:disabled]:opacity-50 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-[#67e8f9]">
              <CodeGenerator />
            </div>
          </section>

          <section className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-white">Таныг харж буй хүмүүс</h2>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-[#9fb4bb]">{guardians.length}</span>
            </div>
            {guardians.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-[13px] leading-6 text-[#9fb4bb]">Одоогоор хэн ч холбогдоогүй байна.<br /></p>
            ) : (
              <ul className="divide-y divide-white/10">
                {guardians.map((guardian) => (
                  <li key={guardian.linkId} className="flex min-h-14 items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[#0e7490]/35 text-sm font-semibold text-[#67e8f9]">
                        {guardian.name?.[0] ?? "Э"}
                      </span>
                      <span className="text-[16px] font-medium text-white">{guardian.name}</span>
                    </div>
                    <form action={unlink}>
                      <input type="hidden" name="linkId" value={guardian.linkId} />
                      <button type="submit" className="ml-auto inline-flex items-center rounded-full border border-cyan-200 px-3 py-1.5 text-sm text-cyan-200">
                        Салгах
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
