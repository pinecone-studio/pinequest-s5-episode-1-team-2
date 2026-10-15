import { unlink } from "@/app/actions/auth";
import { CodeEntry } from "@/components/auth/pairing";
import { BackHeader, AppShell } from "@/components/safe-path";
import { requireRole } from "@/lib/auth/dal";
import { listLinkedPeople } from "@/lib/auth/pairing";

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
  "--sp-risk": "#E57C66",
} as React.CSSProperties;

export default async function GuardianLinkPage() {
  const guardian = await requireRole("guardian");
  const children = await listLinkedPeople(guardian.id, "guardian");

  return (
    <AppShell>
      <div
        style={TOKENS}
        className="min-h-dvh bg-[linear-gradient(180deg,var(--sp-bg-top)_0%,var(--sp-bg-bottom)_45%,var(--sp-bg-bottom)_100%)] text-(--sp-ink)"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 mx-auto h-56 max-w-107.5 bg-[radial-gradient(60%_80%_at_80%_0%,rgba(79,143,168,0.22),transparent_70%)]"
        />

        <main className="relative min-h-dvh pb-[calc(40px+env(safe-area-inset-bottom))]">
          <div className="[&_header]:border-b [&_header]:border-(--sp-line) [&_a]:text-(--sp-ink) [&_a:hover]:bg-(--sp-primary-soft) [&_a:hover]:text-(--sp-primary) [&_a]:transition-all [&_a]:rounded-full">
            <BackHeader title="Хүмүүс" />
          </div>

          <div className="px-5 pt-4">
            <section className="rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-5 shadow-sm">
              <h2 className="text-[17px] font-semibold text-(--sp-ink)">
                Хүүхэд холбох
              </h2>
              <p className="mb-5 mt-1 text-[14px] leading-6 text-(--sp-muted)">
                Хүүхдийнхээ утсан дээрх кодыг оруулна уу.
              </p>

              {/* Button CodeEntry keessaa akka button "Гарах" sanaatti bifa qabaatu gochuu */}
              <div className="[&_input]:border-(--sp-line) [&_input]:bg-black/60 [&_input]:text-(--sp-ink) [&_input]:placeholder:text-(--sp-muted) [&_input:focus]:border-(--sp-primary) [&_input:focus]:ring-(--sp-primary-soft) [&_button]:flex [&_button]:min-h-12 [&_button]:w-full [&_button]:items-center [&_button]:justify-center [&_button]:gap-2.5 [&_button]:rounded-2xl [&_button]:border [&_button]:border-[#22d3ee]/40 [&_button]:bg-[#0e7490]/30 [&_button]:px-5 [&_button]:text-[15px] [&_button]:font-semibold [&_button]:text-white [&_button]:shadow-[0_0_15px_-3px_rgba(14,116,144,0.3)] [&_button]:transition-all [&_button]:duration-200 [&_button:hover]:border-[#22d3ee]/80 [&_button:hover]:bg-[#0e7490]/60 [&_button:active]:scale-[0.98] [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-[#67e8f9]">
                <CodeEntry />
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-5 shadow-sm">
              <h2 className="text-[17px] font-semibold text-(--sp-ink)">
                Холбогдсон хүүхдүүд
              </h2>

              {children.length === 0 ? (
                <p className="mt-3 text-[14px] text-(--sp-muted)">
                  Одоогоор хүүхэд холбогдоогүй байна.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-(--sp-line)">
                  {children.map((child) => (
                    <li
                      key={child.linkId}
                      className="flex min-h-14 items-center justify-between gap-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-full bg-(--sp-primary-soft) text-sm font-semibold text-(--sp-primary)">
                          {child.name?.[0] ?? "Х"}
                        </span>
                        <span className="text-[16px] font-medium text-(--sp-ink)">
                          {child.name}
                        </span>
                      </div>

                      <form action={unlink}>
                        <input
                          type="hidden"
                          name="linkId"
                          value={child.linkId}
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/60 hover:bg-rose-500/20 active:scale-95"
                        >
                          Салгах
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
      </div>
    </AppShell>
  );
}