"use client";

import { useRef, useState } from "react";
import { Camera, Check, Footprints, X } from "lucide-react";
import { SafePathLoading } from "@/components/safepath-loading";

/**
 * A small task on the way to the place the child is heading, in place of a game: count the steps
 * there, or photograph a building on the way so their guardian can see where they are.
 */
export type WalkingTask = {
  kind: "steps" | "photo";
  /** The place the task leads to; the task ends when the child is guided somewhere else. */
  targetId: string;
  targetName: string;
};

type Point = { latitude: number; longitude: number };
type PhotoStatus = "idle" | "sending" | "sent" | "not-shared" | "error";

// Roughly one walking step of a child.
const STEP_METERS = 0.5;
// Enough to make out a building, and well under the server's 400 KB limit.
const PHOTO_MAX_SIDE = 640;
const PHOTO_QUALITY = 0.7;

/** Steps to walk `meters`, rounded to tens once there are many, since it is an estimate. */
export function stepsFor(meters: number) {
  const steps = Math.max(1, Math.round(meters / STEP_METERS));
  return steps < 50 ? steps : Math.round(steps / 10) * 10;
}

/** What the companion says when it hands out the task. */
export function walkingTaskMessage(task: WalkingTask, userName: string, remainingMeters: number) {
  const name = userName.trim();
  const lead = name ? `${name}, ` : "";
  if (task.kind === "steps") {
    return `${lead}${task.targetName} хүртэл ойролцоогоор ${stepsFor(remainingMeters)} алхам байна. Алхмаа тоолоод очоорой!`;
  }
  return `${lead}${task.targetName} хүртэл явах замдаа харагдах нэг том барилгын зургийг аваад ээж аавдаа илгээгээрэй. Зураг авахдаа түр зогсоорой.`;
}

/** Shrinks a camera photo to a small JPEG data URL, the form the server accepts. */
async function toJpeg(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}

/** The task card: live steps left, or a button that opens the camera and sends the photo. */
export function WalkingTaskCard({ task, remainingMeters, location, onClose }: {
  task: WalkingTask;
  /** Distance left to the place, or null while unknown. */
  remainingMeters: number | null;
  location: Point | null;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<PhotoStatus>("idle");
  const arrived = remainingMeters !== null && remainingMeters < 5;

  async function send(file: File) {
    if (!location) return setPhoto("error");
    setPhoto("sending");
    try {
      const response = await fetch("/api/scene-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: await toJpeg(file), latitude: location.latitude, longitude: location.longitude }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error("Photo upload failed.");
      const saved = Boolean(result && typeof result === "object" && "saved" in result && result.saved === true);
      setPhoto(saved ? "sent" : "not-shared");
    } catch {
      setPhoto("error");
    }
  }

  const Icon = task.kind === "steps" ? Footprints : Camera;
  const title = task.kind === "steps" ? "Алхмаа тоол" : "Барилгын зураг";
  const detail =
    task.kind === "steps"
      ? arrived
        ? "Ирлээ! Нийт хэдэн алхам болсон бэ?"
        : remainingMeters === null
          ? `${task.targetName} хүртэл алхмаа тоолоорой`
          : `${task.targetName} хүртэл ≈ ${stepsFor(remainingMeters)} алхам үлдлээ`
      : photo === "sent"
        ? "Илгээлээ! Ээж аав чинь харж байна."
        : photo === "not-shared"
          ? "Байршил хуваалцах зогссон тул илгээгдсэнгүй."
          : photo === "error"
            ? "Илгээж чадсангүй. Дахин оролдоорой."
            : "Замдаа харсан том барилгын зургийг ээж аавдаа илгээ.";

  return (
    <section
      aria-label="Замын даалгавар"
      className="relative z-10 mt-3 flex items-center gap-3 rounded-2xl bg-linear-to-r from-[#0e7490] to-[#0891b2] px-3 py-2.5 ring-1 ring-[#67e8f9]/30 shadow-[0_10px_28px_rgba(8,145,178,.3)]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 text-white" aria-hidden="true">
        {photo === "sent" ? <Check size={20} /> : <Icon size={20} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-5 text-white">{title}</p>
        <p role="status" className="line-clamp-2 text-[13px] leading-5 text-[#e0f7fb]">{detail}</p>
      </div>
      {task.kind === "photo" && photo !== "sent" && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void send(file);
            }}
          />
          <button
            type="button"
            disabled={photo === "sending"}
            onClick={() => input.current?.click()}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-bold text-[#0e7490] transition hover:bg-[#ecfeff] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {photo === "sending" ? <SafePathLoading variant="button" /> : <Camera size={14} aria-hidden="true" />}
            {photo === "sending" ? "Илгээж байна…" : "Зураг авах"}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Даалгаврыг хаах"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  );
}
