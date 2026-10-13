import { redirect } from "next/navigation";
import { AppShell } from "@/components/safe-path";
import { SignupForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/auth/dal";
import { homeFor } from "@/lib/auth/routes";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <AppShell>
      <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[linear-gradient(155deg,#05090d_0%,#07151b_52%,#03080c_100%)] px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] sm:px-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-[12%] size-72 rounded-full bg-[#06b6d4]/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-[#0e7490]/30 blur-3xl"
        />
        <header className="relative z-10 mx-auto flex h-14 w-full max-w-[390px] items-center">
          <BrandMark />
        </header>
        <section className="relative z-10 mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-6">
          <div className="mb-7">
            <span
              className="mb-5 grid size-12 place-items-center rounded-2xl border border-[#22d3ee]/40 bg-[#0e7490]/50 text-[#a5f3fc]"
              aria-hidden="true"
            >
              <ShieldIcon />
            </span>
            <p className="mb-2 text-sm font-semibold tracking-wide text-[#67e8f9]">
              Шинэ бүртгэл
            </p>
            <h1 className="text-[32px] font-bold leading-tight tracking-[-0.045em] text-white">
              Бүртгүүлэх
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-[#c2d0d5]">
              Бүртгэлийн мэдээллээ оруулна уу.
            </p>
          </div>
          <SignupForm />
        </section>
      </main>
    </AppShell>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.3)]">
        <svg
          viewBox="0 0 24 24"
          className="size-[22px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.5" fill="currentColor" />
        </svg>
      </span>
      <span className="text-[16px] font-bold tracking-[-0.04em] text-[#f0f6f1]">
        SafePath
      </span>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="M12 3 19 6v5c0 4.7-2.9 8-7 10-4.1-2-7-5.3-7-10V6l7-3Z"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
