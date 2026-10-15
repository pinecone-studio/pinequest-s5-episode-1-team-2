"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { SafePathLoading } from "@/components/safepath-loading";
import { addCheckpoint, removeCheckpoint } from "@/app/actions/checkpoints";
import { RewardBadge } from "@/components/reward-badge";
import { ACCESSORIES, REWARD_COMPANIONS, describeReward, type RewardId } from "@/types/rewards";
import type { Checkpoint } from "@/types/location";
import type { FormState } from "@/types/auth";
import type { SafeZone } from "@/types/safety";

const ZoneMap = dynamic(() => import("@/components/zone-map"), {
  ssr: false,
  loading: () => <SafePathLoading className="h-full" label="Газрын зураг ачаалж байна…" />,
});

type Point = { latitude: number; longitude: number };

const RADIUS_OPTIONS = [30, 50, 100, 200];
/** Where the map starts when there is nothing else to show: central Ulaanbaatar. */
const DEFAULT_CENTER: Point = { latitude: 47.9186, longitude: 106.9176 };
const field = "mt-2 h-12 w-full rounded-xl border border-(--sp-line) bg-black/40 px-4 text-[16px] text-(--sp-ink) outline-none transition placeholder:text-(--sp-muted) focus:border-[#a78bfa] focus:ring-2 focus:ring-[#7c3aed]/30";

/** Lets a guardian give a child a place to reach and choose what they win for reaching it. */
export function CheckpointEditor({ childId, childName, zones, checkpoints, childPosition, initialPoint = null }: {
  childId: string;
  childName: string;
  zones: SafeZone[];
  checkpoints: Checkpoint[];
  childPosition: Point | null;
  /** A point tapped on the guardian's home map, already selected. */
  initialPoint?: Point | null;
}) {
  const [point, setPoint] = useState<Point | null>(initialPoint);
  const [radius, setRadius] = useState(50);
  const [reward, setReward] = useState<RewardId>(REWARD_COMPANIONS[0]);
  const [state, action, pending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await addCheckpoint(previous, formData);
    if (result?.success) setPoint(null);
    return result;
  }, undefined);

  const center = point ?? childPosition ?? zones[0] ?? DEFAULT_CENTER;
  const pointError = state?.errors?.latitude?.[0] ?? state?.errors?.longitude?.[0];
  // Shown on the map like zones, so the guardian sees the goals already set.
  const openAsZones: SafeZone[] = checkpoints
    .filter((checkpoint) => !checkpoint.reachedAt)
    .map((checkpoint) => ({ id: checkpoint.id, name: `🎯 ${checkpoint.name}`, latitude: checkpoint.latitude, longitude: checkpoint.longitude, radiusMeters: checkpoint.radiusMeters }));

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-2xl border border-(--sp-line) bg-(--sp-surface)">
        <div className="px-4 py-3">
          <h2 className="text-[15px] font-semibold">1. Очих газраа сонгох</h2>
          <p className="mt-0.5 text-xs leading-5 text-(--sp-muted)">
            {point ? "Цэг сонгогдлоо. Өөр газар дарвал цэг шилжинэ." : "Газрын зураг дээр хүүхдийн очих газрыг нэг цэгээр дарж сонгоно уу."}
          </p>
        </div>
        <div className="h-[44vh] min-h-[280px] max-h-[460px] overflow-hidden">
          <ZoneMap center={center} zones={openAsZones} draft={point} draftRadius={radius} childPosition={childPosition} onPick={(latitude, longitude) => setPoint({ latitude, longitude })} />
        </div>
      </section>

      <section className={`rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-4 transition-opacity ${point ? "" : "opacity-60"}`}>
        <h2 className="text-[15px] font-semibold">2. Хэмжээ, нэр, шагнал</h2>
        <p className="mt-0.5 text-xs leading-5 text-(--sp-muted)">{childName} тэр газарт үнэхээр хүрч очвол сонгосон шагнал нь автоматаар нээгдэнэ.</p>
        <form action={action} className="mt-3 grid gap-4">
          <input type="hidden" name="childId" value={childId} />
          <input type="hidden" name="latitude" value={point?.latitude ?? ""} />
          <input type="hidden" name="longitude" value={point?.longitude ?? ""} />
          <input type="hidden" name="reward" value={reward} />
          <input type="hidden" name="radiusMeters" value={radius} />
          {pointError && <p role="alert" className="text-sm text-(--sp-risk)">{pointError}</p>}

          <div>
            <p className="text-[13px] font-semibold text-(--sp-muted)">Хэр ойр очих вэ</p>
            <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Хэр ойр очих вэ">
              {RADIUS_OPTIONS.map((meters) => (
                <button
                  key={meters}
                  type="button"
                  role="radio"
                  aria-checked={radius === meters}
                  disabled={!point}
                  onClick={() => setRadius(meters)}
                  className={`min-h-10 rounded-xl border text-sm font-semibold transition disabled:opacity-50 ${radius === meters ? "border-[#a78bfa] bg-[#7c3aed]/20 text-[#c4b5fd]" : "border-(--sp-line) text-(--sp-muted) hover:text-(--sp-ink)"}`}
                >
                  {meters} м
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="checkpoint-name" className="text-[13px] font-semibold text-(--sp-muted)">Газрын нэр</label>
            <input id="checkpoint-name" name="name" placeholder="Сургууль, Номын сан…" maxLength={40} autoComplete="off" defaultValue={state?.values?.name} className={field} />
            {state?.errors?.name?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-(--sp-risk)">{error}</p>)}
          </div>

          <fieldset>
            <legend className="text-[13px] font-semibold text-(--sp-muted)">Шагнал</legend>
            <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Шагнал сонгох">
              {[...REWARD_COMPANIONS, ...ACCESSORIES.map((accessory) => accessory.id)].map((id) => {
                const selected = reward === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setReward(id)}
                    className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-center transition ${selected ? "bg-[#7c3aed]/20 ring-2 ring-[#a78bfa]" : "hover:bg-white/5"}`}
                  >
                    <RewardBadge reward={id} size="picker" />
                    <span className={`text-[11px] leading-4 ${selected ? "font-semibold text-(--sp-ink)" : "text-(--sp-muted)"}`}>{describeReward(id).label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          {state?.errors?.reward?.map((error) => <p key={error} role="alert" className="text-sm text-(--sp-risk)">{error}</p>)}
          {state?.message && <p role="alert" className="text-sm text-(--sp-risk)">{state.message}</p>}
          {state?.success && <p role="status" className="text-sm text-(--sp-safe)">{state.success}</p>}
          <button type="submit" disabled={pending || !point} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-5 text-sm font-semibold text-white transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:bg-(--sp-line) disabled:text-(--sp-muted)">
            {pending && <SafePathLoading variant="button" />}{pending ? "Хадгалж байна…" : point ? "Шалгах цэг өгөх" : "Эхлээд газрын зураг дээр цэг сонгоно уу"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-4">
        <h2 className="text-[15px] font-semibold">Шалгах цэгүүд</h2>
        {checkpoints.length === 0 ? (
          <p className="mt-3 rounded-xl bg-black/30 px-3 py-3 text-sm leading-6 text-(--sp-muted)">Одоогоор шалгах цэг алга.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {checkpoints.map((checkpoint) => (
              <li key={checkpoint.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-(--sp-line) px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <RewardBadge reward={checkpoint.reward} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{checkpoint.name}</span>
                    <span className={`mt-0.5 block text-xs ${checkpoint.reachedAt ? "text-(--sp-safe)" : "text-(--sp-muted)"}`}>
                      {checkpoint.reachedAt
                        ? `✅ Хүрсэн · ${new Date(checkpoint.reachedAt).toLocaleString("mn-MN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                        : `Хүлээж байна · ${describeReward(checkpoint.reward).label} шагналтай`}
                    </span>
                  </span>
                </div>
                {!checkpoint.reachedAt && (
                  <form action={removeCheckpoint} className="shrink-0">
                    <input type="hidden" name="checkpointId" value={checkpoint.id} />
                    <button type="submit" aria-label={`Устгах: ${checkpoint.name}`} className="min-h-9 rounded-lg px-3 text-xs font-medium text-(--sp-muted) transition hover:bg-(--sp-risk-bg) hover:text-(--sp-risk)">Устгах</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
