import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { AppShell } from "@/components/safe-path";

/** The guardian app's dark colours, shared by its home screen and its settings screens. */
export const GUARDIAN_THEME = {
  "--sp-primary": "#4F8FA8",
  "--sp-primary-deep": "#3D7891",
  "--sp-primary-soft": "rgba(79,143,168,0.18)",
  "--sp-secondary": "#72B8B0",
  "--sp-bg": "#000000",
  "--sp-bg-top": "#081619",
  "--sp-bg-bottom": "#000000",
  "--sp-ink": "#E6F1F3",
  "--sp-muted": "#87A0A8",
  "--sp-line": "#1B2C32",
  "--sp-surface": "#0C171B",
  "--sp-safe": "#72B8B0",
  "--sp-safe-bg": "rgba(114,184,176,0.12)",
  "--sp-caution": "#E0A84A",
  "--sp-caution-bg": "rgba(224,168,74,0.12)",
  "--sp-risk": "#E57C66",
  "--sp-risk-bg": "rgba(229,124,102,0.13)",
} as CSSProperties;

/** A guardian sub-screen (zones, checkpoints): the home screen's dark look, a back button and a title. */
export function GuardianScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppShell>
      <div
        style={GUARDIAN_THEME}
        className="min-h-dvh bg-[linear-gradient(180deg,var(--sp-bg-top)_0%,var(--sp-bg-bottom)_45%,var(--sp-bg-bottom)_100%)] pb-[calc(32px+env(safe-area-inset-bottom))] text-(--sp-ink)"
      >
        <header className="flex min-h-16 items-center gap-1 border-b border-(--sp-line) px-5 pt-[env(safe-area-inset-top)]">
          <BackButton className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full transition hover:bg-(--sp-line) focus-visible:outline-2 focus-visible:outline-offset-2">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </BackButton>
          <div className="min-w-0">
            <Link href="/guardian" className="text-[17px] font-semibold tracking-tight">SafePath</Link>
            <h1 className="mt-0.5 truncate text-sm text-(--sp-muted)">{title}</h1>
          </div>
        </header>
        <div className="px-4 pt-4">{children}</div>
      </div>
    </AppShell>
  );
}

/** Chips for switching between linked children on a guardian sub-screen. */
export function ChildTabs({ items, selectedId, hrefFor }: { items: { childId: string; name: string }[]; selectedId: string; hrefFor: (childId: string) => string }) {
  if (items.length < 2) return null;
  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Хүүхэд сонгох">
      {items.map((child) => (
        <Link
          key={child.childId}
          href={hrefFor(child.childId)}
          aria-current={child.childId === selectedId ? "page" : undefined}
          className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${child.childId === selectedId ? "border-(--sp-primary) bg-(--sp-primary-soft) text-(--sp-ink)" : "border-(--sp-line) bg-(--sp-surface) text-(--sp-muted) hover:text-(--sp-ink)"}`}
        >
          {child.name}
        </Link>
      ))}
    </nav>
  );
}
