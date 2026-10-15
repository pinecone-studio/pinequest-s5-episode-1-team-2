"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { AppShell, CompanionMark } from "@/components/safe-path";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { useCheckpoints } from "@/hooks/use-checkpoints";
import { ACCESSORIES, FREE_COMPANIONS, REWARD_COMPANIONS, REWARD_IDS, isRewardLocked } from "@/types/rewards";
import type { AssistantSettings } from "@/types/safety";

const COMPANIONS: AssistantSettings["avatar"][] = [...FREE_COMPANIONS, ...REWARD_COMPANIONS];

/** One screen where the child picks, dresses and names their AI friend, seeing the result live. */
export default function CompanionPage() {
  const { settings, update } = useAssistantSettings();
  const { rewards, isChild } = useCheckpoints({ poll: false });
  const locked = (id: string) => isRewardLocked(id, rewards, isChild);
  const avatar = locked(settings.avatar) ? "Мило" : settings.avatar;
  const accessory = settings.accessory && !locked(settings.accessory) ? settings.accessory : null;
  const earned = REWARD_IDS.filter((id) => !locked(id)).length;
  const name = settings.name || avatar;
  // An empty saved name falls back to the default, so keep what is typed until the field is left.
  const [draftName, setDraftName] = useState<string | null>(null);

  return (
    <AppShell>
      <main
        className="relative isolate min-h-dvh w-full overflow-x-hidden px-4 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] text-[#f0f6f1]"
        style={{ background: "linear-gradient(160deg, #1a0b3b 0%, #07151b 55%, #03080c 100%)" }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-10 size-72 rounded-full bg-[#7c3aed]/25 blur-3xl" />

        <header className="relative z-10 mx-auto flex h-14 w-full max-w-[420px] items-center gap-2">
          <Link
            href="/tracker"
            aria-label="Буцах"
            className="-ml-2 grid size-11 place-items-center rounded-full text-[#e9e3ff] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]"
          >
            <ChevronLeft size={24} aria-hidden="true" />
          </Link>
          <h1 className="text-[20px] font-extrabold tracking-tight">Миний AI найз</h1>
          {isChild && (
            <span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-[#e9e3ff]" aria-label={`${REWARD_IDS.length}-аас ${earned} шагнал цуглуулсан`}>
              🏆 {earned}/{REWARD_IDS.length}
            </span>
          )}
        </header>

        <div className="relative z-10 mx-auto w-full max-w-[420px]">
          {/* Live preview: every tap below changes this right away. */}
          <section aria-label="Урьдчилан харах" className="flex flex-col items-center pt-4">
            <CompanionMark state="idle" avatar={avatar} accessory={accessory} name={name} className="companion-avatar--compact" />
            <label htmlFor="companion-name" className="sr-only">Найзын нэр</label>
            <input
              id="companion-name"
              value={draftName ?? settings.name}
              onChange={(event) => {
                const next = event.target.value.slice(0, 40);
                setDraftName(next);
                if (next.trim()) update("name", next.trim());
              }}
              onBlur={() => setDraftName(null)}
              placeholder="Найзаа нэрлээрэй"
              autoComplete="off"
              className="mt-4 h-12 w-56 rounded-2xl border border-white/15 bg-white/5 px-4 text-center text-[20px] font-bold text-white outline-none placeholder:text-white/40 focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#c4b5fd]/30"
            />
            <p className="mt-2 text-[13px] text-[#c9bff0]">Нэр дээр дарж найзаа нэрлэж болно</p>
          </section>

          <section aria-labelledby="pick-friend" className="mt-7">
            <h2 id="pick-friend" className="mb-3 text-[16px] font-bold">Найзаа сонго</h2>
            <div className="grid grid-cols-4 gap-2.5" role="radiogroup" aria-labelledby="pick-friend">
              {COMPANIONS.map((companion) => {
                const isLocked = locked(companion);
                const selected = avatar === companion;
                return (
                  <button
                    key={companion}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={isLocked}
                    aria-label={isLocked ? `${companion}: шалгах цэгт хүрч нээнэ` : companion}
                    onClick={() => update("avatar", companion)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-2xl p-2 transition disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd] ${selected ? "bg-white/12 ring-2 ring-[#c4b5fd]" : "bg-white/5 enabled:hover:bg-white/10"}`}
                  >
                    <span className={`companion-picker__art companion-picker__art--${companion.toLowerCase()} ${isLocked ? "opacity-30 grayscale" : ""}`} aria-hidden="true" />
                    {isLocked && <span className="absolute top-6 text-xl" aria-hidden="true">🔒</span>}
                    {selected && (
                      <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-[#c4b5fd] text-[#1e1035]" aria-hidden="true">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}
                    <span className={`text-[12px] ${selected ? "font-bold text-white" : "text-[#d4cdf0]"}`}>{companion}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="pick-accessory" className="mt-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="pick-accessory" className="text-[16px] font-bold">Чимэглэл зүүлгэ</h2>
              {accessory && (
                <button
                  type="button"
                  onClick={() => update("accessory", null)}
                  className="min-h-9 rounded-full px-3 text-[13px] font-semibold text-[#c4b5fd] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]"
                >
                  Тайлах
                </button>
              )}
            </div>
            {/* Six accessories in two even rows of three. */}
            <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-labelledby="pick-accessory">
              {ACCESSORIES.map((item) => {
                const isLocked = locked(item.id);
                const selected = accessory === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={isLocked}
                    aria-label={isLocked ? `${item.label}: шалгах цэгт хүрч нээнэ` : item.label}
                    onClick={() => update("accessory", item.id)}
                    className={`flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl transition disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd] ${selected ? "bg-white/12 ring-2 ring-[#c4b5fd]" : "bg-white/5 enabled:hover:bg-white/10"}`}
                  >
                    <span className={`text-[30px] leading-none ${isLocked ? "opacity-40 grayscale" : ""}`} aria-hidden="true">{isLocked ? "🔒" : item.icon}</span>
                    <span className={`text-[12px] ${selected ? "font-bold text-white" : "text-[#d4cdf0]"}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {isChild && earned < REWARD_IDS.length && (
            <p className="mt-6 rounded-2xl bg-[#7c3aed]/20 px-4 py-3 text-[14px] leading-5 text-[#e9e3ff] ring-1 ring-[#c4b5fd]/25">
              🎯 🔒 тэмдэгтэй найз, чимэглэлийг ээж, аавын өгсөн шалгах цэгт хүрч очоод нээгээрэй!
            </p>
          )}

          <Link
            href="/tracker"
            className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#a78bfa] text-[17px] font-bold text-[#1e1035] transition hover:bg-[#c4b5fd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Боллоо, хамт явъя!
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
