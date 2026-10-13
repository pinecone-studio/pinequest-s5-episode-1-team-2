"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { SafePathLoading } from "@/components/safepath-loading";
import { addZone, removeZone } from "@/app/actions/zones";
import type { FormState } from "@/types/auth";
import type { SafeZone } from "@/types/safety";

const ZoneMap = dynamic(() => import("@/components/zone-map"), {
  ssr: false,
  loading: () => <SafePathLoading tone="light" className="h-full" label="Газрын зураг ачаалж байна…" />,
});

type Point = { latitude: number; longitude: number };

const RADIUS_OPTIONS = [100, 200, 300, 500, 1000];
/** Where the map starts when there is nothing else to show: central Ulaanbaatar. */
const DEFAULT_CENTER: Point = { latitude: 47.9186, longitude: 106.9176 };
const field = "mt-2 h-12 w-full rounded-xl border border-[#e7e7e5] bg-white px-4 text-[16px] outline-none transition focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10";

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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)] lg:items-start">
      <section className="min-w-0 overflow-hidden rounded-3xl border border-[#e9e9e5] bg-white shadow-[0_8px_30px_rgba(17,17,17,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div><h2 className="text-base font-semibold tracking-tight">Бүсийн байршил</h2><p className="mt-1 text-xs text-[#737373]">Газрын зураг дээр дарж төв цэгийг сонгоно уу.</p></div>
          <span className="rounded-full bg-[#eef5ef] px-3 py-1.5 text-xs font-medium text-[#39714d]">{zones.length} бүс</span>
        </div>
        <div className="h-[42vh] min-h-[300px] max-h-[520px] overflow-hidden bg-[#f1f1ee] sm:h-[480px] lg:h-[560px]">
          <ZoneMap center={center} zones={zones} draft={point} draftRadius={radius} childPosition={childPosition} onPick={(latitude, longitude) => setPoint({ latitude, longitude })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eeeeeb] px-5 py-3 sm:px-6">
          <p className="text-xs leading-5 text-[#737373]">{point ? "Байршил сонгогдлоо. Баруун талд нэр, хэмжээг тохируулна уу." : "Шинэ бүсийн төвийг газрын зураг дээр сонгоно уу."}</p>
          <button type="button" onClick={pickMyLocation} disabled={locating} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[#22231f] underline underline-offset-4 transition hover:bg-[#f7f7f5] disabled:opacity-50">
            {locating && <SafePathLoading variant="button" />}{locating ? "Байршил тогтоож байна…" : "Миний байршил"}
          </button>
        </div>
      </section>

      <div className="grid gap-6">
      <section className="rounded-3xl border border-[#e9e9e5] bg-[#fafaf8] p-5 sm:p-6">
      <div className="mb-5"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#778077]">Шинэ бүс</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Бүсээ тохируулах</h2><p className="mt-1 text-sm leading-5 text-[#737373]">Газрын зураг дээр цэгээ сонгоод нэр, радиусыг оруулна.</p></div>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="childId" value={childId} />
        <input type="hidden" name="latitude" value={point?.latitude ?? ""} />
        <input type="hidden" name="longitude" value={point?.longitude ?? ""} />
        {pointError && <p role="alert" className="text-sm text-[#c64242]">{pointError}</p>}
        <div>
          <label htmlFor="zone-name" className="text-[13px] font-semibold text-[#393a36]">Бүсийн нэр</label>
          <input id="zone-name" name="name" placeholder="Гэр, Сургууль…" maxLength={40} autoComplete="off" defaultValue={state?.values?.name} className={field} />
          {state?.errors?.name?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-[#c64242]">{error}</p>)}
        </div>
        <div>
          <label htmlFor="zone-radius" className="text-[13px] font-semibold text-[#393a36]">Радиус</label>
          <select id="zone-radius" name="radiusMeters" value={radius} onChange={(event) => setRadius(Number(event.target.value))} className={field}>
            {RADIUS_OPTIONS.map((meters) => <option key={meters} value={meters}>{meters} м</option>)}
          </select>
          <p className="mt-2 text-xs leading-5 text-[#737373]">Бүсийн хэмжээ газрын зураг дээр тойргоор харагдана.</p>
        </div>
        {state?.message && <p role="alert" className="text-sm text-[#c64242]">{state.message}</p>}
        {state?.success && <p role="status" className="text-sm text-[#2e7d4f]">{state.success}</p>}
        <button type="submit" disabled={pending || !point} className="mt-1 inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 text-sm font-semibold text-white transition hover:bg-[#30312d] disabled:cursor-not-allowed disabled:bg-[#c8c8c4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
          {pending && <SafePathLoading variant="button" />}{pending ? "Хадгалж байна…" : "Аюулгүй бүс хадгалах"}
        </button>
      </form>
      </section>

      <section className="rounded-3xl border border-[#e9e9e5] bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold tracking-tight">Хадгалсан бүсүүд</h2><p className="mt-1 text-xs text-[#737373]">Нэр болон радиусыг нэг дороос харна.</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f4f5f1] text-sm font-semibold">{zones.length}</span></div>
      {zones.length === 0 ? (
        <p className="mt-4 rounded-xl bg-[#f7f7f5] px-4 py-3 text-sm leading-6 text-[#737373]">Одоогоор хадгалсан бүс алга. Эхний бүсээ газрын зургаас сонгож нэмээрэй.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {zones.map((zone) => (
            <li key={zone.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#eeeeeb] px-3 py-3">
              <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef5ef] text-[#39714d]"><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{zone.name}</span><span className="mt-0.5 block text-xs text-[#737373]">Радиус · {zone.radiusMeters} м</span></span></div>
              <form action={removeZone} className="shrink-0">
                <input type="hidden" name="zoneId" value={zone.id} />
                <button type="submit" aria-label={`${zone.name} бүсийг устгах`} className="min-h-10 rounded-lg px-3 text-xs font-medium text-[#777873] transition hover:bg-[#fff0ef] hover:text-[#b43d35]">Устгах</button>
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
