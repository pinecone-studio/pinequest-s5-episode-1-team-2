"use client";

import { Navigation, PartyPopper, Sparkles, Star, Target, X } from "lucide-react";
import { RewardBadge } from "@/components/reward-badge";
import { describeReward } from "@/types/rewards";
import type { Checkpoint } from "@/types/location";

type Point = { latitude: number; longitude: number };

function metersBetween(a: Point, b: Point) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

/**
 * The child's current goal: where to go, how far, and what they win. `onGuide` offers to walk
 * there with the camera; `onStop` ends that walk.
 */
export function CheckpointGoal({ goal, location, compact = false, onGuide, onStop }: {
  goal: Checkpoint;
  location: Point | null;
  compact?: boolean;
  onGuide?: () => void;
  onStop?: () => void;
}) {
  const reward = describeReward(goal.reward);
  const remaining = location ? Math.max(0, metersBetween(location, goal) - goal.radiusMeters) : null;
  return (
    <section
      aria-label="Миний зорилго"
      className={`relative z-10 mt-3 flex items-center gap-3 rounded-2xl bg-linear-to-r from-[#4c1d95] to-[#6d28d9] px-3 ring-1 ring-[#c4b5fd]/30 shadow-[0_10px_28px_rgba(76,29,149,.35)] ${compact ? "py-2" : "py-3"}`}
    >
      <RewardBadge reward={goal.reward} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] font-bold leading-5 text-white"><Target size={15} className="shrink-0" aria-hidden="true" />{goal.name}</p>
        <p className="truncate text-[13px] leading-5 text-[#e9e3ff]">
          Хүрвэл <b>{reward.label}</b> {reward.companion ? "найз" : "чимэглэл"} чинийх болно!
        </p>
      </div>
      {remaining !== null && (
        <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[13px] font-bold text-white">
          {remaining < 5 ? "Ирлээ!" : formatDistance(remaining)}
        </span>
      )}
      {onGuide && (
        <button
          type="button"
          onClick={onGuide}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-bold text-[#4c1d95] transition hover:bg-[#ede9fe] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Navigation size={14} aria-hidden="true" />
          Зам заах
        </button>
      )}
      {onStop && (
        <button
          type="button"
          onClick={onStop}
          aria-label="Зам заахыг зогсоох"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

/** Full-screen "you did it" moment when a goal is reached, with a button to use the reward right away. */
export function RewardCelebration({ checkpoint, userName, onUse, onClose }: {
  checkpoint: Checkpoint;
  userName: string;
  onUse: () => void;
  onClose: () => void;
}) {
  const reward = describeReward(checkpoint.reward);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="reward-title" className="fixed inset-0 z-[1000] grid place-items-center bg-black/70 px-5 backdrop-blur-sm">
      <div className="reward-celebration relative w-full max-w-[340px] overflow-hidden rounded-[32px] bg-linear-to-b from-[#2e1065] to-[#0b1620] px-6 pb-6 pt-8 text-center text-white shadow-[0_24px_60px_rgba(0,0,0,.5)] ring-1 ring-[#c4b5fd]/30">
        <div className="reward-celebration__confetti" aria-hidden="true">
          {[
            { Icon: PartyPopper, color: "#f472b6" },
            { Icon: Star, color: "#facc15" },
            { Icon: Sparkles, color: "#a78bfa" },
            { Icon: PartyPopper, color: "#4ade80" },
            { Icon: Star, color: "#fb923c" },
            { Icon: Sparkles, color: "#67e8f9" },
          ].map(({ Icon, color }, index) => (
            <span key={index} style={{ left: `${8 + index * 16}%`, animationDelay: `${index * 120}ms` }}><Icon size={20} color={color} /></span>
          ))}
        </div>
        <div className="reward-celebration__prize mx-auto grid place-items-center">
          <RewardBadge reward={checkpoint.reward} size="lg" />
        </div>
        <h2 id="reward-title" className="mt-5 text-[26px] font-extrabold leading-8 tracking-tight">Баяр хүргэе, {userName}!</h2>
        <p className="mt-2 text-[16px] leading-6 text-[#e9e3ff]">
          Чи <b className="text-white">{checkpoint.name}</b> хүртэл алхаж очлоо. {reward.companion ? "Шинэ найз" : "Шинэ чимэглэл"} <b className="text-white">{reward.label}</b> чинийх боллоо!
        </p>
        <button
          type="button"
          onClick={onUse}
          className="mt-6 inline-flex min-h-13 w-full items-center justify-center rounded-2xl bg-[#a78bfa] px-5 text-[17px] font-bold text-[#1e1035] transition hover:bg-[#c4b5fd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {reward.companion ? "Одоо найзаа болгох" : "Одоо зүүх"}
        </button>
        <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full rounded-2xl text-[15px] font-semibold text-[#c4b5fd] transition hover:bg-white/5">
          Дараа
        </button>
      </div>
    </div>
  );
}
