"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut, MapPin } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { AppShell } from "@/components/safe-path";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import type { AssistantSettings } from "@/types/safety";

const avatars: AssistantSettings["avatar"][] = ["Мило", "Ари", "Номи", "Туяа", "Мяу", "Бамбар", "Пип", "Рокки"];

export default function SettingsPage() {
  const router = useRouter();
  const { settings, update } = useAssistantSettings();

  return (
    <AppShell>
      <main className="relative isolate min-h-dvh overflow-hidden px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] text-[#f0f6f1] sm:px-5 sm:pt-[calc(20px+env(safe-area-inset-top))]" style={{ background: "linear-gradient(155deg, #05090d 0%, #07151b 52%, #03080c 100%)" }}>
        <div aria-hidden="true" className="pointer-events-none absolute right-[-6rem] top-[12%] size-72 rounded-full bg-[#06b6d4]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-[#0e7490]/30 blur-3xl" />
        <header className="relative z-10 mx-auto flex h-14 w-full max-w-[390px] items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
            aria-label="Өмнөх хуудас руу буцах"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-[#d8e8eb] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.3)]"><MapPin size={22} fill="currentColor" strokeWidth={2.2} /></span>
          <span className="text-[18px] font-bold tracking-[-0.04em]">SafePath</span>
          <span className="ml-auto inline-flex items-center justify-center rounded-full border border-cyan-200/40 px-3 py-1.5 text-sm text-cyan-200">
            Тохиргоо
          </span>
          
        </header>

        <form className="relative z-10 mx-auto w-full max-w-[390px] pt-5" onSubmit={(event) => event.preventDefault()}>
          <h1 className="mb-6 text-[29px] font-bold leading-[1.08] tracking-[-0.055em] text-white">AI найз</h1>
          <section className="pb-6">
            <label htmlFor="user-name" className="text-[13px] font-medium text-cyan-200">Хэрэглэгчийн нэр</label>
            <input id="user-name" value={settings.userName} onChange={(event) => update("userName", event.target.value)} className="mt-2 min-h-12 w-full border-0 border-b border-white/15 bg-transparent px-0 text-[18px] font-medium text-white outline-none focus:border-[#67e8f9]" />
          </section>
<SettingsSection title="Дүр">
  <div className="grid grid-cols-4 gap-2" role="group" aria-label="Туслахын дүр">
    {avatars.map((avatar) => {
      const selected = settings.avatar === avatar;
      return (
        <button
          key={avatar}
          type="button"
          aria-pressed={selected}
          onClick={() => update("avatar", avatar)}
          className="group flex flex-col items-center justify-center min-w-0 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
        >
          <span
            className={`companion-picker__art companion-picker__art--${avatar.toLowerCase()} ${
              selected ? "ring-2 ring-[#67e8f9] ring-offset-2 ring-offset-[#07151b]" : ""
            }`}
            aria-hidden="true"
          />
          <span className={`mt-2 block text-xs ${selected ? "font-semibold text-white" : "text-[#c2d0d5]"}`}>
            {avatar}
          </span>
        </button>
      );
    })}
  </div>
</SettingsSection>
 
  <SettingsSection title="Дуу хоолой">
  <div className="flex items-center gap-4">
    {(["Эмэгтэй", "Эрэгтэй"] as const).map((voice) => (
      <button
        key={voice}
        type="button"
        onClick={() => update("voice", voice)}
        className="flex items-center gap-2 text-[16px] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
      >
        <span
          className={`grid size-5 place-items-center rounded-full border ${
            settings.voice === voice ? "border-[#67e8f9]" : "border-white/30"
          }`}
          aria-hidden="true"
        >
          {settings.voice === voice && (
            <span className="size-2.5 rounded-full bg-[#67e8f9]" />
          )}
        </span>
        {voice}
      </button>
    ))}
  </div>
</SettingsSection>

<div className="grid grid-cols-3 gap-1 text-xs">
  <SettingsSection title="Өнгө аяс">
    <div className="[&_button]:px-1 [&_button]:py-1 [&_button]:text-[11px]">
      <SegmentedControl
        label="Өнгө аяс"
        value={settings.tone}
        options={["Тайван", "Найрсаг"]}
        onChange={(value) => update("tone", value as AssistantSettings["tone"])}
      />
    </div>
  </SettingsSection>

  <SettingsSection title="Ярианы хурд">
    <div className="[&_button]:px-1 [&_button]:py-1 [&_button]:text-[11px]">
      <SegmentedControl
        label="Ярианы хурд"
        value={settings.speechSpeed}
        options={["Удаан", "Энгийн"]}
        onChange={(value) => update("speechSpeed", value as AssistantSettings["speechSpeed"])}
      />
    </div>
  </SettingsSection>

  <SettingsSection title="Зааврын урт">
    <div className="[&_button]:px-1 [&_button]:py-1 [&_button]:text-[11px]">
      <SegmentedControl
        label="Зааврын урт"
        value={settings.instructionLength}
        options={["Богино", "Энгийн"]}
        onChange={(value) => update("instructionLength", value as AssistantSettings["instructionLength"])}
      />
    </div>
  </SettingsSection>
</div>       
</form>

        <form action={logout} className="relative z-10 mx-auto w-full max-w-[390px]">
          <button type="submit" className="flex min-h-14 w-full items-center gap-3 border-t border-white/15 text-left text-[15px] font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]">
            <LogOut className="size-5 text-[#c2d0d5]" strokeWidth={1.8} aria-hidden="true" />
            <span className="flex-1">Гарах</span>
          </button>
        </form>
      </main>
    </AppShell>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-t border-white/15 py-6"><h2 className="mb-4 text-[15px] font-medium text-[#c2d0d5]">{title}</h2>{children}</section>;
}

function SegmentedControl({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1">
      {options.map((option) => (
        <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className={`min-h-11 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-[#67e8f9] ${value === option ? "border border-[#22d3ee]/60 bg-[#0e7490] text-white" : "border border-transparent text-[#c2d0d5]"}`}>{option}</button>
      ))}
    </div>
  );
}
