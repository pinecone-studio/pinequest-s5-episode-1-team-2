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
  loading: () => <SafePathLoading tone="light" className="h-full" label="Газрын зураг ачаалж байна…" />,
});

type Point = { latitude: number; longitude: number };

const RADIUS_OPTIONS = [30, 50, 100, 200];
/** Where the map starts when there is nothing else to show: central Ulaanbaatar. */
const DEFAULT_CENTER: Point = { latitude: 47.9186, longitude: 106.9176 };
const field = "mt-2 h-12 w-full rounded-xl border border-[#e7e7e5] bg-white px-4 text-[16px] outline-none transition focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10";

/** Lets a guardian give a child a place to reach and choose what they win for reaching it. */
export function CheckpointEditor({ childId, childName, zones, checkpoints, childPosition }: {
  childId: string;
  childName: string;
  zones: SafeZone[];
  checkpoints: Checkpoint[];
  childPosition: Point | null;
}) {
  const [point, setPoint] = useState<Point | null>(null);
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)] lg:items-start">
      <section className="min-w-0 overflow-hidden rounded-3xl border border-[#e9e9e5] bg-white shadow-[0_8px_30px_rgba(17,17,17,0.04)]">
        <div className="px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold tracking-tight">Очих газар</h2>
          <p className="mt-1 text-xs text-[#737373]">Газрын зураг дээр хүүхдийн очих газрыг дарж сонгоно уу.</p>
        </div>
        <div className="h-[42vh] min-h-[300px] max-h-[520px] overflow-hidden bg-[#f1f1ee] sm:h-[480px] lg:h-[560px]">
          <ZoneMap center={center} zones={openAsZones} draft={point} draftRadius={radius} childPosition={childPosition} onPick={(latitude, longitude) => setPoint({ latitude, longitude })} />
        </div>
      </section>

      <div className="grid gap-6">
        <section className="rounded-3xl border border-[#e9e9e5] bg-[#fafaf8] p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#778077]">Шинэ зорилго</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Шалгах цэг өгөх</h2>
            <p className="mt-1 text-sm leading-5 text-[#737373]">{childName} тэр газарт үнэхээр хүрч очвол сонгосон шагнал нь автоматаар нээгдэнэ.</p>
          </div>
          <form action={action} className="grid gap-4">
            <input type="hidden" name="childId" value={childId} />
            <input type="hidden" name="latitude" value={point?.latitude ?? ""} />
            <input type="hidden" name="longitude" value={point?.longitude ?? ""} />
            <input type="hidden" name="reward" value={reward} />
            {pointError && <p role="alert" className="text-sm text-[#c64242]">{pointError}</p>}
            <div>
              <label htmlFor="checkpoint-name" className="text-[13px] font-semibold text-[#393a36]">Газрын нэр</label>
              <input id="checkpoint-name" name="name" placeholder="Сургууль, Номын сан…" maxLength={40} autoComplete="off" defaultValue={state?.values?.name} className={field} />
              {state?.errors?.name?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-[#c64242]">{error}</p>)}
            </div>
            <div>
              <label htmlFor="checkpoint-radius" className="text-[13px] font-semibold text-[#393a36]">Хэр ойр очих вэ</label>
              <select id="checkpoint-radius" name="radiusMeters" value={radius} onChange={(event) => setRadius(Number(event.target.value))} className={field}>
                {RADIUS_OPTIONS.map((meters) => <option key={meters} value={meters}>{meters} м дотор</option>)}
              </select>
            </div>
            <fieldset>
              <legend className="text-[13px] font-semibold text-[#393a36]">Шагнал</legend>
              <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Шагнал сонгох">
                {[...REWARD_COMPANIONS, ...ACCESSORIES.map((accessory) => accessory.id)].map((id) => {
                  const selected = reward === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setReward(id)}
                      className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-center transition ${selected ? "bg-white ring-2 ring-[#7c3aed]" : "hover:bg-white"}`}
                    >
                      <RewardBadge reward={id} />
                      <span className="text-[11px] leading-4 text-[#393a36]">{describeReward(id).label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {state?.errors?.reward?.map((error) => <p key={error} role="alert" className="text-sm text-[#c64242]">{error}</p>)}
            {state?.message && <p role="alert" className="text-sm text-[#c64242]">{state.message}</p>}
            {state?.success && <p role="status" className="text-sm text-[#2e7d4f]">{state.success}</p>}
            <button type="submit" disabled={pending || !point} className="mt-1 inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-5 text-sm font-semibold text-white transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:bg-[#c8c8c4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c3aed]">
              {pending && <SafePathLoading variant="button" />}{pending ? "Хадгалж байна…" : point ? "Шалгах цэг өгөх" : "Эхлээд газрын зураг дээр цэг сонгоно уу"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-[#e9e9e5] bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold tracking-tight">Шалгах цэгүүд</h2>
          {checkpoints.length === 0 ? (
            <p className="mt-4 rounded-xl bg-[#f7f7f5] px-4 py-3 text-sm leading-6 text-[#737373]">Одоогоор шалгах цэг алга.</p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {checkpoints.map((checkpoint) => (
                <li key={checkpoint.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#eeeeeb] px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <RewardBadge reward={checkpoint.reward} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{checkpoint.name}</span>
                      <span className={`mt-0.5 block text-xs ${checkpoint.reachedAt ? "text-[#2e7d4f]" : "text-[#737373]"}`}>
                        {checkpoint.reachedAt
                          ? `✅ Хүрсэн · ${new Date(checkpoint.reachedAt).toLocaleString("mn-MN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                          : `Хүлээж байна · ${describeReward(checkpoint.reward).label} шагналтай`}
                      </span>
                    </span>
                  </div>
                  {!checkpoint.reachedAt && (
                    <form action={removeCheckpoint} className="shrink-0">
                      <input type="hidden" name="checkpointId" value={checkpoint.id} />
                      <button type="submit" aria-label={`${checkpoint.name} шалгах цэгийг устгах`} className="min-h-10 rounded-lg px-3 text-xs font-medium text-[#777873] transition hover:bg-[#fff0ef] hover:text-[#b43d35]">Устгах</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
