"use client";

import dynamic from "next/dynamic";
import { Crosshair, MapPin, ShieldCheck, Trash2 } from "lucide-react";
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
const field = "mt-2 h-12 w-full rounded-xl border border-[#e7e7e5] bg-[#fafaf9] px-4 text-[16px] text-[#20211f] outline-none transition focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-[#111111]/10";

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
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)] lg:gap-6">
      <section className="overflow-hidden rounded-3xl border border-[#e7e7e5] bg-white shadow-sm" aria-labelledby="zone-map-title">
        <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1f1ee] text-[#343530]"><MapPin size={19} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 id="zone-map-title" className="text-sm font-semibold text-[#20211f]">Газрын зураг</h2>
            <p className="mt-0.5 text-xs leading-5 text-[#737373]">Газрын зураг дээр дарж бүсийн төвийг сонгоно уу.</p>
          </div>
        </div>
        <div className="h-[42vh] min-h-[280px] max-h-[560px] border-y border-[#e7e7e5] bg-[#f1f1ee] sm:h-[460px] lg:h-[min(66vh,640px)]">
          <ZoneMap center={center} zones={zones} draft={point} draftRadius={radius} childPosition={childPosition} onPick={(latitude, longitude) => setPoint({ latitude, longitude })} />
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="flex min-w-0 items-start gap-2 text-xs leading-5 text-[#737373]">
            <span className={`mt-0.5 size-2 shrink-0 rounded-full ${point ? "bg-[#2e7d4f]" : "bg-[#aaa9a3]"}`} aria-hidden="true" />
            <span>{point ? "Төвийн цэг сонгогдлоо. Нэр, радиусаа оруулаад хадгална уу." : "Шинэ бүс нэмэхийн тулд газрын зураг дээр цэг сонгоно уу."}</span>
          </p>
          <button type="button" onClick={pickMyLocation} disabled={locating} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#e7e7e5] px-4 text-[13px] font-medium text-[#20211f] transition hover:bg-[#f7f7f5] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
            <Crosshair size={16} aria-hidden="true" />
            {locating ? "Байршил тогтоож байна…" : "Миний байршил"}
          </button>
        </div>
      </section>

      <div className="grid gap-5">
        <section className="rounded-3xl border border-[#e7e7e5] bg-white p-4 shadow-sm sm:p-5" aria-labelledby="zone-form-title">
          <div className="mb-5 flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1f1ee] text-[#343530]"><ShieldCheck size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="zone-form-title" className="text-sm font-semibold text-[#20211f]">Шинэ аюулгүй бүс</h2>
              <p className="mt-1 text-xs leading-5 text-[#737373]">Газрын зураг дээр цэг сонгоод бүсийн мэдээллээ оруулна уу.</p>
            </div>
          </div>
          <form action={action} className="grid gap-4">
            <input type="hidden" name="childId" value={childId} />
            <input type="hidden" name="latitude" value={point?.latitude ?? ""} />
            <input type="hidden" name="longitude" value={point?.longitude ?? ""} />
            {pointError && <p role="alert" className="rounded-xl bg-[#fff3f1] px-3 py-2 text-sm text-[#b93832]">{pointError}</p>}
            <div>
              <label htmlFor="zone-name" className="text-[13px] font-medium text-[#393a36]">Бүсийн нэр</label>
              <input id="zone-name" name="name" placeholder="Жишээ нь: Гэр, Сургууль" maxLength={40} autoComplete="off" defaultValue={state?.values?.name} className={field} />
              {state?.errors?.name?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-[#b93832]">{error}</p>)}
            </div>
            <div>
              <label htmlFor="zone-radius" className="text-[13px] font-medium text-[#393a36]">Радиус</label>
              <select id="zone-radius" name="radiusMeters" value={radius} onChange={(event) => setRadius(Number(event.target.value))} className={field}>
                {RADIUS_OPTIONS.map((meters) => <option key={meters} value={meters}>{meters} метр</option>)}
              </select>
              <p className="mt-1.5 text-xs text-[#85857f]">Сонгосон цэгийн эргэн тойрны бүсийн хэмжээ.</p>
            </div>
            {state?.message && <p role="alert" className="rounded-xl bg-[#fff3f1] px-3 py-2 text-sm text-[#b93832]">{state.message}</p>}
            {state?.success && <p role="status" className="rounded-xl bg-[#edf7f0] px-3 py-2 text-sm text-[#276b43]">{state.success}</p>}
            <button type="submit" disabled={pending} className="mt-1 inline-flex min-h-[50px] w-full items-center justify-center rounded-xl bg-[#171815] px-5 text-sm font-semibold text-white transition hover:bg-[#343530] disabled:cursor-not-allowed disabled:bg-[#c8c8c4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
              {pending ? "Түр хүлээнэ үү…" : "Аюулгүй бүс нэмэх"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-[#e7e7e5] bg-white p-4 shadow-sm sm:p-5" aria-labelledby="zones-list-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="zones-list-title" className="text-sm font-semibold text-[#20211f]">Хадгалсан бүсүүд</h2>
              <p className="mt-1 text-xs text-[#737373]">{zones.length} бүс тохируулсан</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-[#f1f1ee] text-sm font-semibold text-[#393a36]">{zones.length}</span>
          </div>
          {zones.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-[#deded9] bg-[#fafaf9] px-4 py-5 text-center text-sm leading-6 text-[#737373]">Одоогоор бүс нэмээгүй байна.<br />Газрын зураг дээр цэг сонгоод эхлүүлээрэй.</p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {zones.map((zone) => (
                <li key={zone.id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#ededea] bg-[#fafaf9] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#4c7e5d] shadow-sm"><MapPin size={17} aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#20211f]">{zone.name}</p>
                      <p className="mt-0.5 text-xs text-[#737373]">Радиус · {zone.radiusMeters} м</p>
                    </div>
                  </div>
                  <form action={removeZone}>
                    <input type="hidden" name="zoneId" value={zone.id} />
                    <button type="submit" aria-label={`${zone.name} бүсийг устгах`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#777771] transition hover:bg-[#fff0ee] hover:text-[#b93832] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
                      <Trash2 size={15} aria-hidden="true" /><span className="hidden sm:inline">Устгах</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
