import Link from "next/link";
import { ChevronRight, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/safe-path";

export default function Home() {
  return (
    <AppShell>
      <main className="flex min-h-dvh flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="SafePath нүүр" className="flex min-h-11 items-center rounded-xl text-[17px] font-semibold tracking-[-0.025em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
            SafePath
          </Link>
          <Link href="/settings" aria-label="Тохиргоо" className="grid size-11 place-items-center rounded-xl text-[#737373] transition hover:bg-[#f7f7f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
            <Settings2 size={18} strokeWidth={1.8} />
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center pb-8" aria-labelledby="start-title">
          <h1 id="start-title" className="text-[28px] font-semibold tracking-[-0.04em]">Та хэн бэ?</h1>
          <p className="mt-2 text-[14px] text-[#737373]">Үргэлжлүүлэх горимоо сонгоно уу.</p>
          <div className="mt-6 grid gap-2">
            <Link href="/guardian" className="group flex min-h-[76px] items-center gap-3 rounded-2xl bg-[#f7f7f5] px-4 py-3 transition-colors hover:bg-[#f1f1ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#393a36]"><ShieldCheck size={19} strokeWidth={1.7} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Эцэг эх / Асран хамгаалагч</span><span className="mt-1 block text-[12px] text-[#737373]">Байршил, аюулгүй байдлыг харах</span></span>
              <ChevronRight size={18} className="shrink-0 text-[#737373] transition-transform group-hover:translate-x-0.5" />
            </Link>

            <Link href="/tracker" className="group flex min-h-[76px] items-center gap-3 rounded-2xl bg-[#f7f7f5] px-4 py-3 transition-colors hover:bg-[#f1f1ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#393a36]"><UserRound size={19} strokeWidth={1.7} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Хэрэглэгч</span><span className="mt-1 block text-[12px] text-[#737373]">Милотой ярилцах</span></span>
              <ChevronRight size={18} className="shrink-0 text-[#737373] transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
