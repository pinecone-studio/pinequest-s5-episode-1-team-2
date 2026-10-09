import { changeLinkedChildRole, unlink } from "@/app/actions/auth";
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

              <div className="[&_input]:border-(--sp-line) [&_input]:bg-black/60 [&_input]:text-(--sp-ink) [&_input]:placeholder:text-(--sp-muted) [&_input:focus]:border-(--sp-primary) [&_input:focus]:ring-(--sp-primary-soft) [&_button]:bg-[linear-gradient(135deg,var(--sp-primary-deep)_0%,var(--sp-primary)_100%)] [&_button]:text-white">
                <CodeEntry />
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold text-(--sp-ink)">
                  Холбогдсон хүүхдүүд
                </h2>
                <span className="rounded-full bg-(--sp-primary-soft) px-2.5 py-1 text-xs font-semibold text-(--sp-primary)">
                  {children.length}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-(--sp-muted)">
                Хүүхдийн үүргийг эндээс засахад бүртгэлд нь хадгалагдана.
              </p>

              {children.length === 0 ? (
                <p className="mt-3 text-[14px] text-(--sp-muted)">
                  Одоогоор хүүхэд холбогдоогүй байна.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {children.map((child) => (
                    <li
                      key={child.linkId}
                      className="min-w-0 rounded-2xl border border-(--sp-line) bg-black/20 p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-(--sp-primary-soft) text-sm font-semibold text-(--sp-primary)">
                          {child.name?.[0] ?? "Х"}
                        </span>
                        <span className="min-w-0 break-words text-[15px] font-semibold text-(--sp-ink)">
                          {child.name}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <form action={changeLinkedChildRole} className="grid min-w-0 gap-2">
                          <input type="hidden" name="childId" value={child.userId} />
                          <label htmlFor={`role-${child.linkId}`} className="text-xs font-medium text-(--sp-muted)">
                            Үүрэг
                          </label>
                          <select
                            id={`role-${child.linkId}`}
                            name="role"
                            defaultValue={child.role ?? "child"}
                            className="min-h-12 w-full min-w-0 rounded-xl border border-(--sp-line) bg-[#071114] px-3 text-sm text-(--sp-ink) outline-none focus:border-(--sp-primary)"
                          >
                            <option value="child">Хүүхэд</option>
                            <option value="guardian">Асран хамгаалагч</option>
                          </select>
                          <button
                            type="submit"
                            className="min-h-11 w-full rounded-xl bg-(--sp-primary-soft) px-4 text-sm font-semibold text-(--sp-primary) transition-colors hover:brightness-110 active:scale-[0.99]"
                          >
                            Хадгалах
                          </button>
                        </form>
                        <form action={unlink} className="border-t border-(--sp-line) pt-2">
                          <input
                            type="hidden"
                            name="linkId"
                            value={child.linkId}
                          />
                          <button
                            type="submit"
                            className="min-h-10 rounded-xl px-3 text-sm font-medium text-(--sp-risk) transition-colors hover:bg-black/40 active:scale-[0.99]"
                          >
                            Хүүхдийг салгах
                          </button>
                        </form>
                      </div>
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
