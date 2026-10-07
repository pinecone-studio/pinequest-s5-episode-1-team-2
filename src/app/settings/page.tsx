"use client";

import Link from "next/link";
import { ChevronRight, UserRoundCog } from "lucide-react";
import { AppShell, BackHeader } from "@/components/safe-path";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import type { AssistantSettings } from "@/types/safety";

const avatars: AssistantSettings["avatar"][] = ["Мило", "Ари", "Номи", "Туяа"];

export default function SettingsPage() {
  const { settings, update } = useAssistantSettings();

  return (
    <AppShell>
      <main className="min-h-dvh pb-[calc(24px+env(safe-area-inset-bottom))]">
        <BackHeader title="AI туслах" />

        <form className="px-5 pt-4" onSubmit={(event) => event.preventDefault()}>
          <section className="pb-6">
            <label htmlFor="user-name" className="text-[13px] font-medium text-[#737373]">Хэрэглэгчийн нэр</label>
            <input id="user-name" value={settings.userName} onChange={(event) => update("userName", event.target.value)} className="mt-2 min-h-12 w-full border-0 border-b border-[#e7e7e5] bg-white px-0 text-[18px] font-medium outline-none focus:border-[#111111]" />
          </section>

          <section className="pb-6">
            <label htmlFor="assistant-name" className="text-[13px] font-medium text-[#737373]">Туслахын нэр</label>
            <input id="assistant-name" value={settings.name} onChange={(event) => update("name", event.target.value)} className="mt-2 min-h-12 w-full border-0 border-b border-[#e7e7e5] bg-white px-0 text-[18px] font-medium outline-none focus:border-[#111111]" />
          </section>

          <SettingsSection title="Дүр">
            <div className="flex items-start justify-between gap-3" role="group" aria-label="Туслахын дүр">
              {avatars.map((avatar, index) => {
                const selected = settings.avatar === avatar;
                return (
                  <button key={avatar} type="button" aria-pressed={selected} onClick={() => update("avatar", avatar)} className="group min-h-16 min-w-14 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
                    <span className={`mx-auto grid size-14 place-items-center rounded-full border text-sm font-medium transition ${selected ? "border-[#111111] bg-[#111111] text-white" : "border-[#e7e7e5] bg-[#f7f7f5] text-[#737373]"}`} aria-hidden="true">{["M", "A", "N", "T"][index]}</span>
                    <span className={`mt-2 block text-xs ${selected ? "font-semibold text-[#111111]" : "text-[#737373]"}`}>{avatar}</span>
                  </button>
                );
              })}
            </div>
          </SettingsSection>

          <SettingsSection title="Дуу хоолой">
            <div className="divide-y divide-[#e7e7e5] border-y border-[#e7e7e5]">
              {(["Эмэгтэй", "Эрэгтэй"] as const).map((voice) => (
                <button key={voice} type="button" onClick={() => update("voice", voice)} className="flex min-h-14 w-full items-center justify-between text-left text-[16px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#111111]">
                  {voice}
                  <span className={`grid size-5 place-items-center rounded-full border ${settings.voice === voice ? "border-[#111111]" : "border-[#e7e7e5]"}`} aria-hidden="true">
                    {settings.voice === voice && <span className="size-2.5 rounded-full bg-[#111111]" />}
                  </span>
                </button>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection title="Өнгө аяс">
            <SegmentedControl label="Өнгө аяс" value={settings.tone} options={["Тайван", "Найрсаг"]} onChange={(value) => update("tone", value as AssistantSettings["tone"])} />
          </SettingsSection>

          <SettingsSection title="Ярианы хурд">
            <SegmentedControl label="Ярианы хурд" value={settings.speechSpeed} options={["Удаан", "Энгийн"]} onChange={(value) => update("speechSpeed", value as AssistantSettings["speechSpeed"])} />
          </SettingsSection>

          <SettingsSection title="Зааврын урт">
            <SegmentedControl label="Зааврын урт" value={settings.instructionLength} options={["Богино", "Энгийн"]} onChange={(value) => update("instructionLength", value as AssistantSettings["instructionLength"])} />
          </SettingsSection>

          <section className="border-t border-[#e7e7e5] pt-4">
            <Link href="/role" className="flex min-h-14 items-center gap-3 text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
              <UserRoundCog className="size-5 text-[#737373]" strokeWidth={1.8} aria-hidden="true" />
              <span className="flex-1">Role солих</span>
              <ChevronRight className="size-5 text-[#737373]" strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </section>
        </form>
      </main>
    </AppShell>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-t border-[#e7e7e5] py-6"><h2 className="mb-4 text-[15px] font-medium text-[#737373]">{title}</h2>{children}</section>;
}

function SegmentedControl({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-1 rounded-xl bg-[#f7f7f5] p-1">
      {options.map((option) => (
        <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className={`min-h-11 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-[#111111] ${value === option ? "border border-[#e7e7e5] bg-white text-[#111111]" : "border border-transparent text-[#737373]"}`}>{option}</button>
      ))}
    </div>
  );
}
