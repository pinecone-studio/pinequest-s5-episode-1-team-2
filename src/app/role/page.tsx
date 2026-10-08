import Link from "next/link";
import { ChevronRight, ShieldCheck, UserRound } from "lucide-react";
import { logout, setRole } from "@/app/actions/auth";
import { AppShell } from "@/components/safe-path";
import { requireUser } from "@/lib/auth/dal";

const card = "group flex min-h-[76px] w-full items-center gap-3 rounded-2xl bg-[#f7f7f5] px-4 py-3 text-left transition-colors hover:bg-[#f1f1ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

export default async function RolePage() {
  const user = await requireUser();

  return (
    <AppShell>
      <main className="flex min-h-dvh flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]">
        <p className="text-[17px] font-semibold tracking-[-0.02em]">SafePath</p>

        <div className="flex flex-1 flex-col justify-center py-16">
          <p className="text-center text-[15px] text-[#737373]">Сайн уу, {user.name}</p>
          <h1 className="mt-1 text-center text-[30px] font-semibold leading-[1.14] tracking-[-0.04em]">Та хэн бэ?</h1>

          <div className="mt-6 grid gap-2" role="group" aria-label="Хэрэглэгчийн горим сонгох">
            <form action={setRole}>
              <input type="hidden" name="role" value="guardian" />
              <button type="submit" className={card}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#393a36]"><ShieldCheck size={19} strokeWidth={1.7} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Эцэг эх / Асран хамгаалагч</span><span className="mt-1 block text-[12px] font-normal text-[#737373]">Байршил, аюулгүй байдлыг харах</span></span>
                <ChevronRight size={18} className="shrink-0 text-[#737373] transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
            <form action={setRole}>
              <input type="hidden" name="role" value="child" />
              <button type="submit" className={card}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#393a36]"><UserRound size={19} strokeWidth={1.7} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Хэрэглэгч</span><span className="mt-1 block text-[12px] font-normal text-[#737373]">Милотой ярилцах</span></span>
                <ChevronRight size={18} className="shrink-0 text-[#737373] transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Link href="/settings" className="inline-flex min-h-11 items-center px-4 text-sm font-medium text-[#737373] underline decoration-[#c8c8c4] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
            Тохиргоо
          </Link>
          <form action={logout}>
            <button type="submit" className="inline-flex min-h-11 items-center px-4 text-sm font-medium text-[#737373] underline decoration-[#c8c8c4] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">Гарах</button>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
