import { unlink } from "@/app/actions/auth";
import { CodeGenerator } from "@/components/auth/pairing";
import { AppShell, BackHeader } from "@/components/safe-path";
import { requireRole } from "@/lib/auth/dal";
import { listLinkedPeople } from "@/lib/auth/pairing";

export default async function TrackerCodePage() {
  const child = await requireRole("child");
  const guardians = await listLinkedPeople(child.id, "child");

  return (
    <AppShell>
      <main className="min-h-dvh pb-[calc(24px+env(safe-area-inset-bottom))]">
        <BackHeader title="Холбох код" />
        <div className="px-5 pt-4">
          <p className="mb-5 text-[14px] leading-6 text-[#737373]">Эцэг эхдээ энэ кодыг хэлээрэй. Тэд кодыг оруулсны дараа таны байршлыг харж чадна.</p>
          <CodeGenerator />

          <h2 className="mt-10 border-t border-[#e7e7e5] pt-6 text-[16px] font-semibold">Таныг харж буй хүмүүс</h2>
          {guardians.length === 0 ? (
            <p className="mt-3 text-[14px] text-[#737373]">Одоогоор хэн ч холбогдоогүй байна.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[#e7e7e5]">
              {guardians.map((guardian) => (
                <li key={guardian.linkId} className="flex min-h-14 items-center justify-between gap-3">
                  <span className="text-[16px]">{guardian.name}</span>
                  <form action={unlink}>
                    <input type="hidden" name="linkId" value={guardian.linkId} />
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
