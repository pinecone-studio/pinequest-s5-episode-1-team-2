import { unlink } from "@/app/actions/auth";
import { CodeEntry } from "@/components/auth/pairing";
import { BackHeader, AppShell } from "@/components/safe-path";
import { requireRole } from "@/lib/auth/dal";
import { listLinkedPeople } from "@/lib/auth/pairing";

export default async function GuardianLinkPage() {
  const guardian = await requireRole("guardian");
  const children = await listLinkedPeople(guardian.id, "guardian");

  return (
    <AppShell>
      <main className="min-h-dvh pb-[calc(24px+env(safe-area-inset-bottom))]">
        <BackHeader title="Хүмүүс" />
        <div className="px-5 pt-4">
          <h2 className="text-[16px] font-semibold">Хүүхэд холбох</h2>
          <p className="mb-5 mt-1 text-[14px] leading-6 text-[#737373]">Хүүхдийнхээ утсан дээрх кодыг оруулна уу.</p>
          <CodeEntry />

          <h2 className="mt-10 border-t border-[#e7e7e5] pt-6 text-[16px] font-semibold">Холбогдсон хүүхдүүд</h2>
          {children.length === 0 ? (
            <p className="mt-3 text-[14px] text-[#737373]">Одоогоор хүүхэд холбогдоогүй байна.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[#e7e7e5]">
              {children.map((child) => (
                <li key={child.linkId} className="flex min-h-14 items-center justify-between gap-3">
                  <span className="text-[16px]">{child.name}</span>
                  <form action={unlink}>
                    <input type="hidden" name="linkId" value={child.linkId} />
                    <button type="submit" className="min-h-11 px-2 text-sm text-[#737373] underline underline-offset-4">Салгах</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </AppShell>
  );
}
