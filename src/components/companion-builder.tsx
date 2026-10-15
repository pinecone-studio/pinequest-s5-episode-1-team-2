"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { CustomCompanionArt } from "@/components/custom-companion";
import {
  COMPANION_COLORS,
  COMPANION_EARS,
  COMPANION_EYES,
  COMPANION_MOUTHS,
  type CustomCompanion,
} from "@/types/custom-companion";

const tile = (selected: boolean) =>
  `relative flex flex-col items-center gap-1 rounded-2xl p-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd] ${
    selected ? "bg-white/12 ring-2 ring-[#c4b5fd]" : "bg-white/5 hover:bg-white/10"
  }`;

function Picked() {
  return (
    <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-[#c4b5fd] text-[#1e1035]" aria-hidden="true">
      <Check size={13} strokeWidth={3} />
    </span>
  );
}

function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-5">
      <h3 id={id} className="mb-2.5 text-[15px] font-bold text-[#e9e3ff]">{title}</h3>
      {children}
    </section>
  );
}

/** Part-by-part maker: each option shows the child's own companion with that part changed. */
export function CompanionBuilder({ parts, onChange }: { parts: CustomCompanion; onChange: (next: CustomCompanion) => void }) {
  const set = <K extends keyof CustomCompanion>(key: K, value: CustomCompanion[K]) => onChange({ ...parts, [key]: value });

  return (
    <div>
      <Group id="build-color" title="Өнгө">
        <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-labelledby="build-color">
          {COMPANION_COLORS.map((color) => {
            const selected = parts.color === color.id;
            return (
              <button
                key={color.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={color.label}
                onClick={() => set("color", color.id)}
                className={`aspect-square rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd] ${selected ? "ring-[3px] ring-white ring-offset-2 ring-offset-[#1a0b3b]" : "hover:scale-105"}`}
                style={{ backgroundColor: color.body }}
              />
            );
          })}
        </div>
      </Group>

      <Group id="build-eyes" title="Нүд">
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-labelledby="build-eyes">
          {COMPANION_EYES.map((eyes) => {
            const selected = parts.eyes === eyes.id;
            return (
              <button key={eyes.id} type="button" role="radio" aria-checked={selected} onClick={() => set("eyes", eyes.id)} className={tile(selected)}>
                <CustomCompanionArt parts={{ ...parts, eyes: eyes.id }} className="size-14" />
                {selected && <Picked />}
                <span className={`text-[12px] ${selected ? "font-bold text-white" : "text-[#d4cdf0]"}`}>{eyes.label}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group id="build-mouth" title="Ам">
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-labelledby="build-mouth">
          {COMPANION_MOUTHS.map((mouth) => {
            const selected = parts.mouth === mouth.id;
            return (
              <button key={mouth.id} type="button" role="radio" aria-checked={selected} aria-label={mouth.label} onClick={() => set("mouth", mouth.id)} className={tile(selected)}>
                <CustomCompanionArt parts={{ ...parts, mouth: mouth.id }} className="size-11" />
                {selected && <Picked />}
              </button>
            );
          })}
        </div>
      </Group>

      <Group id="build-ears" title="Чих, толгой">
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-labelledby="build-ears">
          {COMPANION_EARS.map((ears) => {
            const selected = parts.ears === ears.id;
            return (
              <button key={ears.id} type="button" role="radio" aria-checked={selected} onClick={() => set("ears", ears.id)} className={tile(selected)}>
                <CustomCompanionArt parts={{ ...parts, ears: ears.id }} className="size-14" />
                {selected && <Picked />}
                <span className={`text-[12px] ${selected ? "font-bold text-white" : "text-[#d4cdf0]"}`}>{ears.label}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <label className="mt-5 flex min-h-14 cursor-pointer items-center justify-between rounded-2xl bg-white/5 px-4">
        <span className="text-[15px] font-bold text-[#e9e3ff]">Ягаан хацар</span>
        <input
          type="checkbox"
          checked={parts.cheeks}
          onChange={(event) => set("cheeks", event.target.checked)}
          className="size-6 accent-[#a78bfa]"
        />
      </label>
    </div>
  );
}
