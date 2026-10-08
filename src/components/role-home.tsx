import { ArrowUpRight, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { setRole } from "@/app/actions/auth";
import { AppShell } from "@/components/safe-path";

export function RoleHome() {
  return (
    <AppShell>
      <main
        className="relative isolate flex min-h-dvh flex-col overflow-hidden px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] sm:px-5 sm:pb-[calc(24px+env(safe-area-inset-bottom))] sm:pt-[calc(20px+env(safe-area-inset-top))]"
        style={{
          background:
            "linear-gradient(155deg, #05090d 0%, #07151b 52%, #03080c 100%)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-[12%] size-72 rounded-full bg-[#06b6d4]/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-[#0e7490]/30 blur-3xl"
        />
        <header className="relative z-10 mx-auto flex h-14 w-full max-w-[390px] items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.3)]">
            <MapPin size={22} fill="currentColor" strokeWidth={2.2} />
          </span>
          <span className="text-[16px] font-bold tracking-[-0.04em] text-[#f0f6f1]">
            SafePath
          </span>
        </header>

        <section
          className="relative z-10 mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-5 sm:py-8"
          aria-labelledby="role-home-title"
        >
          <h1
            id="role-home-title"
            className="max-w-[350px] text-center text-[29px] font-bold leading-[1.08] tracking-[-0.055em] text-white sm:text-[32px]"
          >
            Таны хэн болох ?
          </h1>

          <div
            className="mt-8 grid grid-cols-2 gap-3"
            role="group"
            aria-label="Хэрэглэгчийн горим сонгох"
          >
            <form action={setRole}>
              <input type="hidden" name="role" value="guardian" />
              <button
                type="submit"
                className="group relative flex min-h-[150px] w-full flex-col items-start gap-4 rounded-[22px] border border-[#22d3ee]/70 bg-[#0e7490] p-3.5 text-left shadow-[0_14px_32px_rgba(6,182,212,.2)] transition duration-200 active:scale-[.99] hover:border-[#67e8f9] hover:bg-[#0c819d] hover:shadow-[0_16px_36px_rgba(6,182,212,.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9] sm:min-h-[200px] sm:p-4"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-white/15 text-white shadow-sm sm:size-[52px] sm:rounded-[18px]">
                  <ShieldCheck size={23} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1 pr-1">
                  <span className="block text-[14px] font-bold leading-[1.25] tracking-[-0.02em] text-white sm:text-[16px]">
                    Асран хамгаалагч
                  </span>
                  <span className="mt-1.5 block text-[11px] leading-[1.4] text-white/85 sm:text-[12px]">
                    Хайртай хүмүүсийн байршлыг хянах
                  </span>
                </span>
                <span className="absolute right-3.5 top-3.5 grid size-8 place-items-center rounded-full bg-white/15 text-white transition-transform group-hover:translate-x-0.5 sm:right-4 sm:top-4">
                  <ArrowUpRight size={17} />
                </span>
              </button>
            </form>

            <form action={setRole}>
              <input type="hidden" name="role" value="child" />
              <button
                type="submit"
                className="group relative flex min-h-[150px] w-full flex-col items-start gap-4 rounded-[22px] border border-[#22d3ee]/45 bg-[#155e75] p-3.5 text-left shadow-[0_14px_32px_rgba(8,145,178,.2)] transition duration-200 active:scale-[.99] hover:border-[#67e8f9] hover:bg-[#176b83] hover:shadow-[0_16px_36px_rgba(8,145,178,.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9] sm:min-h-[200px] sm:p-4"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-white/15 text-white shadow-sm sm:size-[52px] sm:rounded-[18px]">
                  <UserRound size={22} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1 pr-1">
                  <span className="block text-[14px] font-bold leading-[1.25] tracking-[-0.02em] text-white sm:text-[16px]">
                    Хүүхэд / Хэрэглэгч
                  </span>
                  <span className="mt-1.5 block text-[11px] leading-[1.4] text-white/85 sm:text-[12px]">
                    Байршлаа хуваалцаж, Милотой ярилцах
                  </span>
                </span>
                <span className="absolute right-3.5 top-3.5 grid size-8 place-items-center rounded-full bg-white/15 text-white transition-transform group-hover:translate-x-0.5 sm:right-4 sm:top-4">
                  <ArrowUpRight size={17} />
                </span>
              </button>
            </form>
          </div>
        </section>
        <p className="relative z-10 mx-auto mt-auto flex w-full max-w-[390px] items-center justify-center gap-2 pt-5 text-[12px] text-[#c2d0d5]">
          <span className="size-1.5 rounded-full bg-[#22d3ee]" />
          Аюулгүй аялал эндээс эхэлнэ
        </p>
      </main>
    </AppShell>
  );
}
