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

        <div className="relative z-10 mx-auto w-full max-w-[390px] pt-5">
          <h1 className="mb-2 text-[29px] font-bold leading-[1.08] tracking-[-0.055em] text-white">
            Гэр бүлийн холбоо
          </h1>
        
          <section aria-label="Холбох код авах" className="border-t border-white/15 py-6">
            <h2 className="mb-4 text-[15px] font-medium text-cyan-200">Таны холбох код</h2>
            <div className="[&_form]:gap-4 [&_form>div]:rounded-2xl [&_form>div]:border [&_form>div]:border-[#67e8f9]/20 [&_form>div]:bg-[#0d2028] [&_form>div]:px-5 [&_form>div]:py-6 [&_form>div]:text-white [&_form>div>p:first-child]:text-[36px] [&_form>div>p:first-child]:font-semibold [&_form>div>p:first-child]:tracking-[0.3em] [&_form>div>p:last-child]:text-[#b7c7cc] [&_button]:min-h-14 [&_button]:rounded-2xl [&_button]:bg-[#0e7490] [&_button]:px-5 [&_button]:text-[15px] [&_button]:font-bold [&_button]:text-white [&_button]:transition-colors [&_button:hover]:bg-[#0c819d] [&_button:disabled]:opacity-50 [&_button]:focus-visible:outline-[#67e8f9]">
              <CodeGenerator />
            </div>
          </section>

          <section className="border-t border-white/15 py-6">
            <h2 className="mb-4 text-[15px] font-medium text-[#c2d0d5]">Таныг харж буй хүмүүс</h2>
            {guardians.length === 0 ? (
              <p className="text-[14px] leading-6 text-[#b7c7cc]">Одоогоор хэн ч холбогдоогүй байна.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {guardians.map((guardian) => (
                  <li key={guardian.linkId} className="flex min-h-14 items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[#0e7490]/35 text-sm font-semibold text-[#67e8f9]">
                        {guardian.name?.[0] ?? "Э"}
                      </span>
                      <span className="text-[16px] font-medium text-white">{guardian.name}</span>
                    </div>
                    <form action={unlink}>
                      <input type="hidden" name="linkId" value={guardian.linkId} />
                      <button type="submit" className="min-h-11 rounded-xl px-3 text-sm text-[#c2d0d5] underline underline-offset-4 transition hover:text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-[#67e8f9]">
                        Салгах
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
