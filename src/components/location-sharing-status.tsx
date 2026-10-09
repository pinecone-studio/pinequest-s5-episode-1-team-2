"use client";

import { useLocationSharing, type SharingStatus } from "@/hooks/use-location-sharing";

const statusText: Record<SharingStatus, string> = {
  waiting: "Байршил илгээхэд бэлдэж байна…",
  sharing: "Байршлаа асран хамгаалагчтайгаа хуваалцаж байна",
  "no-guardian": "Асран хамгаалагч холбогдоогүй тул байршил хуваалцаагүй",
  "no-location": "Байршил тогтоож чадахгүй байна",
  error: "Байршил илгээж чадсангүй. Дахин оролдож байна…",
  stopped: "Байршил хуваалцахгүй байна",
};

/** Sends the child's position while shown, says who can see it, and lets the child pause sharing. */
export function LocationSharingStatus() {
  const { status, sharing, saving, saveFailed, setPaused } = useLocationSharing();
  const paused = sharing?.paused === true;
  const text = paused
    ? "Байршил хуваалцахыг түр зогсоосон"
    : status === "sharing" && sharing
      ? `Байршлаа ${sharing.watchers} хүнтэй хуваалцаж байна`
      : statusText[status];
  const canToggle = sharing !== null && status !== "stopped" && (paused || sharing.watchers > 0);

  return (
    <div className="mt-3 text-center">
      <p role="status" className="flex items-center justify-center gap-2 text-[13px] text-[#b7c7cc]">
        <span className={`size-2 shrink-0 rounded-full ${!paused && status === "sharing" ? "bg-[#67e8a5]" : "bg-[#60747b]"}`} aria-hidden="true" />
        {text}
      </p>
      {canToggle && (
        <button
          type="button"
          disabled={saving}
          onClick={() => void setPaused(!paused)}
          className="mt-1 inline-flex min-h-11 items-center px-4 text-[14px] font-medium text-[#67e8f9] underline decoration-[#1d7080] underline-offset-4 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
        >
          {paused ? "Үргэлжлүүлэх" : "Түр зогсоох"}
        </button>
      )}
      {canToggle && !paused && <p className="text-[12px] text-[#84979d]">Түр зогсоовол асран хамгаалагч тань үүнийг харах болно.</p>}
      {saveFailed && <p role="alert" className="text-[12px] text-[#fda4af]">Хадгалж чадсангүй. Дахин оролдоно уу.</p>}
    </div>
  );
}
