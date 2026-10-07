import Link from "next/link";
import { ChevronRight, MapPin, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { AppShell } from "@/components/safe-path";

export default function Home() {
  return (
    <AppShell>
      <main className="flex min-h-dvh flex-col px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="SafePath нүүр" className="flex min-h-11 items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]">
            <span className="grid size-9 place-items-center rounded-xl bg-[#173f35] text-white"><ShieldCheck size={19} strokeWidth={1.8} /></span>
            <span className="text-[16px] font-semibold tracking-[-0.025em]">SafePath</span>
          </Link>
          <Link href="/settings" aria-label="Тохиргоо" className="grid size-10 place-items-center rounded-full text-[#737b75] transition hover:bg-[#f5f6f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]">
            <Settings2 size={18} strokeWidth={1.8} />
          </Link>
        </header>

        <section className="mt-14" aria-labelledby="welcome-title">
          <p className="text-[13px] font-medium text-[#858b86]">ӨДӨР ТУТМЫН АЮУЛГҮЙ БАЙДАЛ</p>
          <h1 id="welcome-title" className="mt-3 max-w-[320px] text-[32px] font-semibold leading-[1.12] tracking-[-0.045em]">Хайртай хүмүүсээ аюулгүй байлга.</h1>
          <p className="mt-3 text-[15px] leading-6 text-[#737973]">Байршил, маршрутаа нэг дороос хянаарай.</p>
        </section>

        <section className="mt-12" aria-labelledby="start-title">
          <h2 id="start-title" className="mb-3 text-[14px] font-medium text-[#858b86]">ҮРГЭЛЖЛҮҮЛЭХ</h2>
          <div className="divide-y divide-[#eeeeeb] border-y border-[#eeeeeb]">
            <Link href="/guardian" className="group flex min-h-[82px] items-center gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f2f5f2] text-[#355347]"><UsersRound size={20} strokeWidth={1.8} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">Асран хамгаалагч</span>
                <span className="mt-1 block text-[13px] text-[#858b86]">Байршил, явцыг хянах</span>
              </span>
              <ChevronRight size={18} className="text-[#a0a5a0] transition group-hover:translate-x-0.5" />
            </Link>

            <Link href="/tracker" className="group flex min-h-[82px] items-center gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f2f5f2] text-[#355347]"><MapPin size={20} strokeWidth={1.8} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">Хэрэглэгч</span>
                <span className="mt-1 block text-[13px] text-[#858b86]">Өөрийн замаа аюулгүй хянах</span>
              </span>
              <ChevronRight size={18} className="text-[#a0a5a0] transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        <div className="mt-auto pt-7">
          <p className="text-center text-[12px] text-[#a0a5a0]">Таны аялалд тайван байдал.</p>
        </div>
      </main>
    </AppShell>
  );
}
