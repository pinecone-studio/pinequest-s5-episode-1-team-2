"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/safe-path";

type Step = "role" | "pin";

export default function RolePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [pin, setPin] = useState("");

  function handlePinChange(value: string) {
    setPin(value.replace(/\D/g, "").slice(0, 4));
  }

  function continueAsGuardian(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pin.length === 4) router.push("/guardian");
  }

  return (
    <AppShell>
      {step === "role" ? (
        <main className="flex min-h-dvh flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]">
          <p className="text-[17px] font-semibold tracking-[-0.02em]">SafePath</p>

          <div className="flex flex-1 flex-col justify-center py-16">
            <h1 className="text-center text-[30px] font-semibold leading-[1.14] tracking-[-0.04em]">
              Та хэн бэ?
            </h1>

            <div className="mt-6 grid gap-2" role="group" aria-label="Хэрэглэгчийн горим сонгох">
              <button type="button" onClick={() => setStep("pin")} className="group flex min-h-[76px] w-full items-center gap-3 rounded-2xl bg-[#f7f7f5] px-4 py-3 text-left transition-colors hover:bg-[#f1f1ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#393a36]"><ShieldCheck size={19} strokeWidth={1.7} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Эцэг эх / Асран хамгаалагч</span><span className="mt-1 block text-[12px] font-normal text-[#737373]">Байршил, аюулгүй байдлыг харах</span></span>
                <ChevronRight size={18} className="shrink-0 text-[#737373] transition-transform group-hover:translate-x-0.5" />
              </button>
              <button type="button" onClick={() => router.push("/tracker")} className="group flex min-h-[76px] w-full items-center gap-3 rounded-2xl bg-[#f7f7f5] px-4 py-3 text-left transition-colors hover:bg-[#f1f1ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#393a36]"><UserRound size={19} strokeWidth={1.7} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Хэрэглэгч</span><span className="mt-1 block text-[12px] font-normal text-[#737373]">Милотой ярилцах</span></span>
                <ChevronRight size={18} className="shrink-0 text-[#737373] transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          <Link href="/settings" className="mx-auto inline-flex min-h-11 items-center px-4 text-sm font-medium text-[#737373] underline decoration-[#c8c8c4] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
            Тохиргоо
          </Link>
        </main>
      ) : (
        <main className="flex min-h-dvh flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
          <header className="flex min-h-16 items-center">
            <button type="button" onClick={() => { setStep("role"); setPin(""); }} aria-label="Үүрэг сонгох дэлгэц рүү буцах" className="-ml-3 grid size-11 place-items-center rounded-xl transition-colors hover:bg-[#f7f7f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
              <span className="text-xl" aria-hidden="true">←</span>
            </button>
          </header>

          <form onSubmit={continueAsGuardian} className="flex flex-1 flex-col justify-center pb-16">
            <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.04em]">Асран хамгаалагчийн PIN</h1>
            <p className="mt-3 max-w-[310px] text-[15px] leading-6 text-[#737373]">Асран хамгаалагчийн хэсэгт нэвтрэхийн тулд 4 оронтой PIN оруулна уу.</p>

            <label htmlFor="guardian-pin" className="sr-only">4 оронтой PIN</label>
            <input
              id="guardian-pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={pin}
              onChange={(event) => handlePinChange(event.target.value)}
              autoFocus
              className="mt-8 h-16 w-full rounded-xl border border-[#e7e7e5] bg-[#f7f7f5] px-5 text-center text-2xl font-semibold tracking-[0.7em] outline-none focus:border-[#111111]"
            />
            <p className="mt-3 text-center text-xs text-[#737373]">Туршилтын хувилбар · дурын 4 орон</p>

            <button type="submit" disabled={pin.length !== 4} className="mt-8 min-h-[52px] rounded-2xl bg-[#111111] px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:bg-[#c8c8c4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
              Үргэлжлүүлэх
            </button>
          </form>
        </main>
      )}
    </AppShell>
  );
}
