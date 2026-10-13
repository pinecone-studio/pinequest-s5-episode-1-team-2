"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, LogOut, MapPin } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { AppShell } from "@/components/safe-path";
import { ProfileForm } from "@/components/auth/profile-form";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import type { AssistantSettings } from "@/types/safety";

const avatars: AssistantSettings["avatar"][] = ["Мило", "Ари", "Номи", "Туяа", "Мяу", "Бамбар", "Пип", "Рокки"];

export default function SettingsPage() {
  const router = useRouter();
  const { settings, update } = useAssistantSettings();
  const [pushToken, setPushToken] = useState("");

  useEffect(() => {
    setPushToken(window.localStorage.getItem("safepath:push-token") ?? "");
  }, []);

  return (
    <AppShell>
      <main className="relative isolate min-h-dvh overflow-hidden px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] text-[#f0f6f1] sm:px-5 sm:pt-[calc(20px+env(safe-area-inset-top))]" style={{ background: "linear-gradient(155deg, #05090d 0%, #07151b 52%, #03080c 100%)" }} >
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
          <span className="grid size-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#67e8f9] to-[#0891b2] text-[#06212a] shadow-[0_6px_18px_rgba(6,182,212,.3)]">
            <MapPin size={22} fill="currentColor" strokeWidth={2.2} />
          </span>
          <span className="text-[18px] font-bold tracking-[-0.04em]">SafePath</span>
          <span className="ml-auto inline-flex items-center justify-center rounded-full border border-cyan-200/40 px-3 py-1.5 text-sm text-cyan-200">
            Тохиргоо
          </span>
        </header>

        <ProfileForm
          afterName={
            <div>
              <label htmlFor="user-name" className="text-[13px] font-medium text-cyan-200">Хэрэглэгчийн нэр</label>
              <input id="user-name" value={settings.userName} onChange={(event) => update("userName", event.target.value)} className="mt-2 min-h-12 w-full border-0 border-b border-white/15 bg-transparent px-0 text-[18px] font-medium text-white outline-none focus:border-[#67e8f9]" />
            </div>
          }
        />

        <form className="relative z-10 mx-auto w-full max-w-[390px] pt-5" onSubmit={(event) => event.preventDefault()}>
          <h1 className="mb-6 text-[29px] font-bold leading-[1.08] tracking-[-0.055em] text-white">AI найз</h1>
          
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
    {(["Эмэгтэй", "Эрэгтэй"] as const).map((voice) => {
      const selected = settings.voice === voice;
      return (
        <button
          key={voice}
          type="button"
          onClick={() => update("voice", voice)}
          className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[15px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9] ${
            selected ? "text-white font-medium bg-white/5" : "text-[#c2d0d5] hover:text-white"
          }`}
        >
          <span
            className={`grid size-5 place-items-center rounded-full border transition-all duration-300 ease-out ${
              selected
                ? "border-[#67e8f9] bg-[#67e8f9]/10  scale-105"
                : "border-white/30 group-hover:border-white/60"
            }`}
            aria-hidden="true"
          >
            <span
              className={`size-2.5 rounded-full bg-[#67e8f9] transition-all duration-300 ease-out ${
                selected ? "scale-100 opacity-100" : "scale-0 opacity-0"
              }`}
            />
          </span>
          {voice}
        </button>
      );
    })}
  </div>
</SettingsSection>

          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <SettingsSection title="Өнгө аяс">
              <SegmentedControl
                label="Өнгө аяс"
                value={settings.tone}
                options={["Тайван", "Найрсаг"]}
                onChange={(value) => update("tone", value as AssistantSettings["tone"])}
              />
            </SettingsSection>

            <SettingsSection title="Ярианы хурд">
              <SegmentedControl
                label="Ярианы хурд"
                value={settings.speechSpeed}
                options={["Удаан", "Энгийн"]}
                onChange={(value) => update("speechSpeed", value as AssistantSettings["speechSpeed"])}
              />
            </SettingsSection>

            <SettingsSection title="Зааврын урт">
              <SegmentedControl
                label="Зааврын урт"
                value={settings.instructionLength}
                options={["Богино", "Энгийн"]}
                onChange={(value) => update("instructionLength", value as AssistantSettings["instructionLength"])}
              />
            </SettingsSection>
          </div>       
        </form>

        <form
  action={logout}
  onSubmit={() => window.localStorage.removeItem("safepath:push-token")}
  className="relative z-10 mx-auto w-full max-w-[390px] pt-6"
>
  <input type="hidden" name="pushToken" value={pushToken} readOnly />

  <button
    type="submit"
    className="group flex min-h-12.5 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#22d3ee]/40 bg-[#0e7490]/30 px-5 text-[15px] font-semibold text-white shadow-[0_0_15px_-3px_rgba(14,116,144,0.3)] transition-all duration-200 hover:border-[#22d3ee]/80 hover:bg-[#0e7490]/60 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
  >
    <LogOut
      className="size-4.5 text-[#67e8f9] transition-transform duration-200 group-hover:-translate-x-0.5"
      strokeWidth={2}
      aria-hidden="true"
    />
    <span>Гарах</span>
  </button>
</form>
      </main>
    </AppShell>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/15 py-6">
      <h2 className="mb-4 text-[15px] font-medium text-gray-200">{title}</h2>
      {children}
    </section>
  );
}

function SegmentedControl({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const activeIndex = options.indexOf(value);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div
      role="group"
      aria-label={label}
      className="relative flex rounded-xl bg-white/10 p-1 border border-white/5 overflow-hidden"
    >
      <div
        className="absolute top-1 bottom-1 rounded-lg border border-[#22d3ee]/60 bg-[#0e7490] transition-transform duration-200 ease-in-out"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${safeIndex * 100}%)`,
        }}
      />

      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`relative z-10 flex-1 min-h-10 rounded-lg px-1 text-[11px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#67e8f9] ${
            value === option ? "text-white font-semibold" : "text-[#c2d0d5] hover:text-white"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}