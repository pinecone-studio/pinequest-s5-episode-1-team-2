"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { addZone, removeZone } from "@/app/actions/zones";
import type { FormState } from "@/types/auth";
import type { SafeZone } from "@/types/safety";

const ZoneMap = dynamic(() => import("@/components/zone-map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[#737373]">Газрын зураг ачаалж байна…</div>,
});

type Point = { latitude: number; longitude: number };

const RADIUS_OPTIONS = [100, 200, 300, 500, 1000];
/** Where the map starts when there is nothing else to show: central Ulaanbaatar. */
const DEFAULT_CENTER: Point = { latitude: 47.9186, longitude: 106.9176 };
const field = "mt-2 h-14 w-full rounded-xl border border-[#e7e7e5] bg-[#f7f7f5] px-4 text-[16px] outline-none focus:border-[#111111]";

/** Lets a guardian place, name and delete a child's safe zones. */
export function ZoneEditor({ childId, zones, childPosition }: { childId: string; zones: SafeZone[]; childPosition: Point | null }) {
  const [point, setPoint] = useState<Point | null>(null);
  const [radius, setRadius] = useState(200);
  const [locating, setLocating] = useState(false);
  const [state, action, pending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await addZone(previous, formData);
    if (result?.success) setPoint(null);
    return result;
  }, undefined);

  function pickMyLocation() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPoint({ latitude: coords.latitude, longitude: coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  const center = point ?? childPosition ?? zones[0] ?? DEFAULT_CENTER;
  const pointError = state?.errors?.latitude?.[0] ?? state?.errors?.longitude?.[0];

  return (
    <div>
      <div className="h-[44vh] min-h-[300px] max-h-[460px] overflow-hidden rounded-[22px] border border-[#e7e7e5] bg-[#f1f1ee]">
        <ZoneMap center={center} zones={zones} draft={point} draftRadius={radius} childPosition={childPosition} onPick={(latitude, longitude) => setPoint({ latitude, longitude })} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[12px] text-[#737373]">{point ? "Цэг сонгогдлоо. Нэр, хэмжээг оруулаад хадгална уу." : "Газрын зураг дээр дарж бүсийн төвийг сонгоно уу."}</p>
        <button type="button" onClick={pickMyLocation} disabled={locating} className="min-h-11 text-[13px] font-medium text-[#111111] underline underline-offset-4 disabled:opacity-50">
          {locating ? "Байршил тогтоож байна…" : "Миний байршлыг ашиглах"}
        </button>
      </div>

      <form action={action} className="mt-4 grid gap-4">
        <input type="hidden" name="childId" value={childId} />
        <input type="hidden" name="latitude" value={point?.latitude ?? ""} />
        <input type="hidden" name="longitude" value={point?.longitude ?? ""} />
        {pointError && <p role="alert" className="text-sm text-[#c64242]">{pointError}</p>}
        <div>
          <label htmlFor="zone-name" className="text-[13px] font-medium text-[#737373]">Нэр</label>
          <input id="zone-name" name="name" placeholder="Гэр, Сургууль…" maxLength={40} autoComplete="off" defaultValue={state?.values?.name} className={field} />
          {state?.errors?.name?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-[#c64242]">{error}</p>)}
        </div>
        <div>
          <label htmlFor="zone-radius" className="text-[13px] font-medium text-[#737373]">Хэмжээ</label>
          <select id="zone-radius" name="radiusMeters" value={radius} onChange={(event) => setRadius(Number(event.target.value))} className={field}>
            {RADIUS_OPTIONS.map((meters) => <option key={meters} value={meters}>{meters} м</option>)}
          </select>
        </div>
        {state?.message && <p role="alert" className="text-sm text-[#c64242]">{state.message}</p>}
        {state?.success && <p role="status" className="text-sm text-[#2e7d4f]">{state.success}</p>}
        <button type="submit" disabled={pending} className="min-h-[52px] rounded-2xl bg-[#111111] px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:bg-[#c8c8c4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
          {pending ? "Түр хүлээнэ үү…" : "Бүс нэмэх"}
        </button>
      </form>

      <h2 className="mt-10 border-t border-[#e7e7e5] pt-6 text-[16px] font-semibold">Бүсүүд</h2>
      {zones.length === 0 ? (
        <p className="mt-3 text-[14px] text-[#737373]">Одоогоор бүс нэмээгүй байна.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#e7e7e5]">
          {zones.map((zone) => (
            <li key={zone.id} className="flex min-h-14 items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[16px]">{zone.name} <span className="text-[13px] text-[#737373]">· {zone.radiusMeters} м</span></span>
              <form action={removeZone}>
                <input type="hidden" name="zoneId" value={zone.id} />
                <button type="submit" className="min-h-11 px-2 text-sm text-[#737373] underline underline-offset-4">Устгах</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
