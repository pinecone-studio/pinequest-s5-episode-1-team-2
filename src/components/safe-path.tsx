import Link from "next/link";
import type { ReactNode } from "react";
import type { SafetyStatus } from "@/types/safety";

export function AppShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-[#f7f7f5] text-[#111111]">
      <div className={`mx-auto min-h-dvh w-full max-w-[430px] bg-white shadow-[0_0_0_1px_rgba(17,17,17,0.025)] ${className}`}>{children}</div>
    </div>
  );
}

export function BackHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-3 px-5 pt-[env(safe-area-inset-top)]">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/" aria-label="Нүүр хуудас руу буцах" className="-ml-2 grid size-11 shrink-0 place-items-center rounded-xl text-[#111111] transition-colors hover:bg-[#f7f7f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
          <ChevronLeftIcon />
        </Link>
        <h1 className="truncate text-[20px] font-semibold tracking-[-0.025em]">{title}</h1>
      </div>
      {right}
    </header>
  );
}

const statusText: Record<SafetyStatus, string> = {
  SAFE: "АЮУЛГҮЙ",
  WARNING: "АНХААР",
  HIGH_RISK: "ӨНДӨР ЭРСДЭЛ",
};

const statusColor: Record<SafetyStatus, string> = {
  SAFE: "text-[#2e7d4f]",
  WARNING: "text-[#b7791f]",
  HIGH_RISK: "text-[#c64242]",
};

export function StatusIndicator({ status }: { status: SafetyStatus }) {
  return (
    <span className={`inline-flex min-h-11 shrink-0 items-center gap-2 text-[13px] font-medium tracking-[0.02em] ${statusColor[status]}`}>
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {statusText[status]}
    </span>
  );
}

export function MockMap({ navigation = false, className = "" }: { navigation?: boolean; className?: string }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-[20px] border border-[#e7e7e5] bg-[#f7f7f5] ${className}`} role="img" aria-label="Байршлын жишээ зураглал">
      <svg className="absolute inset-0 size-full" viewBox="0 0 390 430" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-30 86 C 72 112, 91 159, 179 165 S 299 123, 430 154" fill="none" stroke="#ffffff" strokeWidth="28" />
        <path d="M-30 86 C 72 112, 91 159, 179 165 S 299 123, 430 154" fill="none" stroke="#e7e7e5" strokeWidth="1.5" />
        <path d="M92 -25 C 120 82, 170 106, 179 165 S 145 299, 163 455" fill="none" stroke="#ffffff" strokeWidth="22" />
        <path d="M92 -25 C 120 82, 170 106, 179 165 S 145 299, 163 455" fill="none" stroke="#e7e7e5" strokeWidth="1.5" />
        <path d="M355 -20 C 330 79, 292 113, 280 203 S 317 330, 298 455" fill="none" stroke="#ffffff" strokeWidth="18" />
        <path d="M355 -20 C 330 79, 292 113, 280 203 S 317 330, 298 455" fill="none" stroke="#e7e7e5" strokeWidth="1.5" />
        <path d="M160 372 C 154 300, 167 226, 179 165 S 244 142, 302 145" fill="none" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div className="absolute left-[39%] top-[61%] size-5 rounded-full border-[5px] border-white bg-[#111111]" aria-label="Одоогийн байршил" />
      <div className="absolute left-[75%] top-[29%] -translate-x-1/2" aria-label="Очих газар">
        <div className="grid size-9 place-items-center rounded-full border-[3px] border-white bg-[#111111] text-white"><FlagIcon /></div>
      </div>
      {navigation && (
        <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl bg-[#111111] px-4 py-3 text-white">
          <span className="grid size-10 shrink-0 place-items-center text-2xl" aria-hidden="true">↑</span>
          <div className="min-w-0 flex-1"><p className="font-semibold">Урагшаа яв</p><p className="mt-0.5 text-sm text-white/65">80 м</p></div>
        </div>
      )}
    </div>
  );
}

export function CompanionMark({ state = "idle", className = "" }: { state?: "idle" | "listening" | "speaking" | "warning"; className?: string }) {
  return (
    <div className={`companion-avatar companion-avatar--${state} ${className}`} role="img" aria-label={`Мило AI туслах, ${state}`}>
      <span className="companion-avatar__halo" aria-hidden="true" />
      <span className="companion-avatar__body" aria-hidden="true">
        <span className="companion-avatar__eyes"><i /><i /></span>
        <span className="companion-avatar__mouth" />
      </span>
    </div>
  );
}

export function ArrowRightIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function PhoneIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M7.5 3.8 10 8 7.9 10c1.1 2.5 3.2 4.6 5.8 5.8l2-2.2 4.4 2.5-.8 3.5c-.2.8-.9 1.4-1.8 1.4C9.5 20.5 3.4 14.4 3 6.5c0-.9.5-1.6 1.4-1.8l3.1-.9Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function LocationIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

function ChevronLeftIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function FlagIcon() {
  return <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M7 21V4m0 1h9l-1.5 3L16 11H7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
