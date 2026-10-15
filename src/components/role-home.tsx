import {ArrowUpRight, ShieldCheck, UserRound} from "lucide-react";
import {InstallAppPrompt} from "@/components/install-app-prompt";
import {RoleForm} from "@/components/role-form";
import {AppShell} from "@/components/safe-path";

export function RoleHome() {
  return (
    <AppShell>
      <main
        className="relative isolate flex min-h-dvh flex-col overflow-hidden px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] sm:px-5 sm:pb-[calc(24px+env(safe-area-inset-bottom))] sm:pt-[calc(20px+env(safe-area-inset-top))]"
        style={{
          background:
            "linear-gradient(155deg, #05090d 0%, #07151b 52%, #03080c 100% )",
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

        {/* Header хэсэг */}
        <header className="relative z-10 mx-auto flex h-14 w-full max-w-[390px] items-center gap-2.5">
          <LoadingMark mark="size-10 rounded-[14px]" icon="size-[22px]" />
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
            <RoleForm role="guardian">
              <button
                type="submit"
                className="group relative flex min-h-[160px] w-full flex-col items-start gap-3 rounded-[22px] border border-[#22d3ee]/70 bg-[#0e7490] p-3.5 pb-9 text-left shadow-[0_14px_32px_rgba(6,182,212,.2)] transition duration-200 active:scale-[.99] hover:border-[#67e8f9] hover:bg-[#0c819d] hover:shadow-[0_16px_36px_rgba(6,182,212,.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9] sm:min-h-[210px] sm:p-4 sm:pb-10"
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
            </RoleForm>

            <RoleForm role="child">
              <button
                type="submit"
                className="group relative flex min-h-[160px] w-full flex-col items-start gap-3 rounded-[22px] border border-[#22d3ee]/45 bg-[#155e75] p-3.5 pb-9 text-left shadow-[0_14px_32px_rgba(8,145,178,.2)] transition duration-200 active:scale-[.99] hover:border-[#67e8f9] hover:bg-[#176b83] hover:shadow-[0_16px_36px_rgba(8,145,178,.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9] sm:min-h-[210px] sm:p-4 sm:pb-10"
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
            </RoleForm>
          </div>
        </section>

        <p className="relative z-10 mx-auto mt-auto flex w-full max-w-[390px] items-center justify-center gap-2 pt-5 text-[12px] text-[#c2d0d5]">
          <span className="size-1.5 rounded-full bg-[#22d3ee]" />
          Аюулгүй аялал эндээс эхэлнэ
        </p>
        <InstallAppPrompt />
      </main>
    </AppShell>
  );
}

function LoadingMark({mark, icon}: {mark: string; icon: string}) {
  return (
    <span
      className={`grid place-items-center bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.3)] ${mark}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={icon}
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
  );
}
