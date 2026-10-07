import Link from "next/link";
import type { ReactNode } from "react";
import type { SafetyStatus } from "@/types/safety";

export function AppShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-[#f6f6f4] text-[#111111]">
      <div className={`mx-auto min-h-dvh w-full max-w-[430px] bg-white ${className}`}>{children}</div>
    </div>
  );
}

export function BackHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-3 px-5 pt-[env(safe-area-inset-top)]">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/" aria-label="Нүүр хуудас руу буцах" className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-[#111111] hover:bg-[#f6f6f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
          <ChevronLeftIcon />
        </Link>
        <h1 className="truncate text-[17px] font-semibold tracking-[-0.01em]">{title}</h1>
      </div>
      {right}
    </header>
  );
}

const statusText: Record<SafetyStatus, string> = {
  SAFE: "SAFE",
  WARNING: "АНХААР",
  HIGH_RISK: "ӨНДӨР ЭРСДЭЛ",
};

const statusColor: Record<SafetyStatus, string> = {
  SAFE: "text-[#238636]",
  WARNING: "text-[#b26a00]",
  HIGH_RISK: "text-[#d1242f]",
};

export function StatusIndicator({ status }: { status: SafetyStatus }) {
  return (
    <span className={`inline-flex min-h-11 shrink-0 items-center gap-2 text-xs font-bold tracking-[0.04em] ${statusColor[status]}`}>
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {statusText[status]}
    </span>
  );
}

export function MockMap({ navigation = false, className = "" }: { navigation?: boolean; className?: string }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-[24px] border border-[#e8e8e5] bg-[#f1f1ed] ${className}`} role="img" aria-label="Байршлын жишээ зураглал">
      <svg className="absolute inset-0 size-full" viewBox="0 0 390 430" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-30 86 C 72 112, 91 159, 179 165 S 299 123, 430 154" fill="none" stroke="#ffffff" strokeWidth="28" />
        <path d="M-30 86 C 72 112, 91 159, 179 165 S 299 123, 430 154" fill="none" stroke="#deded9" strokeWidth="1.5" />
        <path d="M92 -25 C 120 82, 170 106, 179 165 S 145 299, 163 455" fill="none" stroke="#ffffff" strokeWidth="22" />
        <path d="M92 -25 C 120 82, 170 106, 179 165 S 145 299, 163 455" fill="none" stroke="#deded9" strokeWidth="1.5" />
        <path d="M355 -20 C 330 79, 292 113, 280 203 S 317 330, 298 455" fill="none" stroke="#ffffff" strokeWidth="18" />
        <path d="M355 -20 C 330 79, 292 113, 280 203 S 317 330, 298 455" fill="none" stroke="#deded9" strokeWidth="1.5" />
        <path d="M160 372 C 154 300, 167 226, 179 165 S 244 142, 302 145" fill="none" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div className="absolute left-[39%] top-[61%] size-5 rounded-full border-[5px] border-white bg-[#111111] shadow-[0_1px_4px_rgba(0,0,0,0.18)]" aria-label="Одоогийн байршил" />
      <div className="absolute left-[75%] top-[29%] -translate-x-1/2" aria-label="Очих газар">
        <div className="grid size-9 place-items-center rounded-full border-[3px] border-white bg-[#111111] text-white shadow-[0_1px_4px_rgba(0,0,0,0.16)]"><FlagIcon /></div>
      </div>
      {navigation && (
        <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl bg-[#111111] px-4 py-3 text-white shadow-[0_2px_8px_rgba(0,0,0,0.16)]">
          <span className="grid size-10 shrink-0 place-items-center text-2xl" aria-hidden="true">↑</span>
          <div className="min-w-0 flex-1"><p className="font-semibold">Урагшаа яв</p><p className="mt-0.5 text-sm text-white/65">80 м</p></div>
        </div>
      )}
    </div>
  );
}

export function CompanionMark() {
  return (
    <div className="grid size-[72px] place-items-center rounded-full border border-[#deded9] bg-[#f6f6f4]" aria-label="AI туслахын дүр">
      <svg viewBox="0 0 32 32" className="size-8" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12.5" cy="14" r="1.3" fill="currentColor" />
        <circle cx="19.5" cy="14" r="1.3" fill="currentColor" />
        <path d="M12 19c1.1 1.1 2.4 1.6 4 1.6s2.9-.5 4-1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
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
