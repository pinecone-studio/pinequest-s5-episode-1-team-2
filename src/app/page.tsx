import Link from "next/link";
import { ChevronRight, Settings2 } from "lucide-react";
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
          <h1 id="start-title" className="mb-5 text-[30px] font-semibold tracking-[-0.04em]">Та хэн бэ?</h1>
          <div className="divide-y divide-[#e7e7e5] border-y border-[#e7e7e5]">
            <Link href="/guardian" className="group flex min-h-[64px] items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
              <span className="min-w-0 flex-1 text-[16px] font-medium">Эцэг эх / Асран хамгаалагч</span>
              <ChevronRight size={18} className="text-[#737373] transition group-hover:translate-x-0.5" />
            </Link>

            <Link href="/tracker" className="group flex min-h-[64px] items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
              <span className="min-w-0 flex-1 text-[16px] font-medium">Хэрэглэгч</span>
              <ChevronRight size={18} className="text-[#737373] transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
