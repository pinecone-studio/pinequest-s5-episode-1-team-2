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

/** Sends the child's position while shown, and tells the child whether it is being shared. */
export function LocationSharingStatus() {
  const status = useLocationSharing();

  return (
    <p role="status" className="mt-3 flex items-center justify-center gap-2 text-center text-[13px] text-[#737373]">
      <span className={`size-2 shrink-0 rounded-full ${status === "sharing" ? "bg-[#2e7d4f]" : "bg-[#c8c8c4]"}`} aria-hidden="true" />
      {statusText[status]}
    </p>
  );
}
