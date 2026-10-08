import { redirect } from "next/navigation";
import { AppShell } from "@/components/safe-path";
import { LoginForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/auth/dal";
import { MapPin } from "lucide-react";

const TOKENS = {
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
  "--sp-input-bg": "#050B0D", 
} as React.CSSProperties;

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/role");

  return (
    <AppShell>
      <div
        style={TOKENS}
        className="min-h-dvh bg-[linear-gradient(180deg,var(--sp-bg-top)_0%,var(--sp-bg-bottom)_45%,var(--sp-bg-bottom)_100%)] text-(--sp-ink) p-5 "
      >
        <style>{`
          .sp-login-form input {
            background-color: var(--sp-input-bg) !important;
            border: 1px solid var(--sp-line) !important;
            color: var(--sp-ink) !important;
            border-radius: 14px !important;
            padding: 12px 16px !important;
            outline: none !important;
            transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
          }
          .sp-login-form input::placeholder {
            color: var(--sp-muted) !important;
            opacity: 0.7;
          }
          .sp-login-form input:focus {
            border-color: var(--sp-primary) !important;
            box-shadow: 0 0 0 2px var(--sp-primary-soft) !important;
          }
          .sp-login-form button[type="submit"] {
            background: linear-gradient(135deg, var(--sp-primary-deep) 0%, var(--sp-primary) 100%) !important;
            color: #ffffff !important;
            border-radius: 16px !important;
            font-weight: 600 !important;
          }
        `}</style>


        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 mx-auto h-56 max-w-107.5 bg-[radial-gradient(60%_80%_at_80%_0%,rgba(79,143,168,0.22),transparent_70%)]"
        />

        <main className="relative flex min-h-dvh flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]">
          <header className="flex min-h-16 items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.3)]">
              <MapPin size={22} fill="currentColor" strokeWidth={2.2} />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-(--sp-ink)">
              SafePath
            </span>
          </header>

          <div className="flex flex-1 flex-col justify-center py-10">
            <div className="mx-auto w-full max-w-md">
              <h1 className="text-[30px] font-semibold leading-[1.14] tracking-[-0.04em] text-(--sp-ink)">
                Нэвтрэх
              </h1>
              <p className="mb-8 mt-2 text-[15px] text-(--sp-muted)">
                Бүртгэлээрээ нэвтэрнэ үү.
              </p>

              <div className="sp-login-form rounded-[22px] border border-(--sp-line) bg-(--sp-surface) p-6 shadow-xl backdrop-blur">
                <LoginForm />
              </div>
            </div>
          </div>
        </main>
      </div>
    </AppShell>
  );
}