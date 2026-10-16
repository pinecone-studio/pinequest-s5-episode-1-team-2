"use client";

import dynamic from "next/dynamic";
import {useActionState, useState} from "react";
import {ChevronDown} from "lucide-react";
import {SafePathLoading} from "@/components/safepath-loading";
import {addZone, removeZone} from "@/app/actions/zones";
import type {FormState} from "@/types/auth";
import type {SafeZone} from "@/types/safety";

const ZoneMap = dynamic(() => import("@/components/zone-map"), {
  ssr: false,
  loading: () => (
    <SafePathLoading
      tone="dark"
      className="h-full"
      label="Газрын зураг ачаалж байна…"
    />
  ),
});

type Point = {latitude: number; longitude: number};

const RADIUS_OPTIONS = [100, 200, 300, 500, 1000];
const DEFAULT_CENTER: Point = {latitude: 47.9186, longitude: 106.9176};

const field =
  "mt-2 h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-[16px] text-white outline-none transition focus:border-[#67e8f9] focus:ring-2 focus:ring-[#67e8f9]/20";

export function ZoneEditor({
  childId,
  zones,
  childPosition,
}: {
  childId: string;
  zones: SafeZone[];
  childPosition: Point | null;
}) {
  const [point, setPoint] = useState<Point | null>(null);
  const [radius, setRadius] = useState(200);
  const [locating, setLocating] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const result = await addZone(previous, formData);
      if (result?.success) setPoint(null);
      return result;
    },
    undefined
  );

  function pickMyLocation() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({coords}) => {
        setPoint({latitude: coords.latitude, longitude: coords.longitude});
        setLocating(false);
      },
      () => setLocating(false),
      {enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000}
    );
  }

  const center = point ?? childPosition ?? zones[0] ?? DEFAULT_CENTER;
  const pointError =
    state?.errors?.latitude?.[0] ?? state?.errors?.longitude?.[0];

  return (
    <div className="grid gap-6 text-[#f0f6f1] lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)] lg:items-start">
      <section className="min-w-0 overflow-hidden rounded-3xl border border-[#22d3ee]/25 bg-[#0b1b20]/90 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-white">
              Бүсийн байршил
            </h2>
            <p className="mt-1 text-xs text-[#9fb4bb]">
              Газрын зураг дээр дарж төв цэгийг сонгоно уу.
            </p>
          </div>
          <span className="rounded-full border border-[#22d3ee]/30 bg-[#0e7490]/30 px-3 py-1.5 text-xs font-medium text-[#67e8f9]">
            {zones.length} бүс
          </span>
        </div>

        <div className="h-[42vh] min-h-[300px] max-h-[520px] overflow-hidden bg-[#05090d] sm:h-[480px] lg:h-[560px]">
          <ZoneMap
            center={center}
            zones={zones}
            draft={point}
            draftRadius={radius}
            childPosition={childPosition}
            onPick={(latitude, longitude) => setPoint({latitude, longitude})}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3 sm:px-6">
          <p className="text-xs leading-5 text-[#9fb4bb]">
            {point
              ? "Байршил сонгогдлоо. Баруун талд нэр, хэмжээг тохируулна уу."
              : "Шинэ бүсийн төвийг газрын зураг дээр сонгоно уу."}
          </p>
          <button
            type="button"
            onClick={pickMyLocation}
            disabled={locating}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[#67e8f9] underline underline-offset-4 transition hover:bg-white/10 disabled:opacity-50"
          >
            {locating && <SafePathLoading variant="button" />}
            {locating ? "Байршил тогтоож байна…" : "Миний байршил"}
          </button>
        </div>
      </section>

      <div className="grid gap-6">
        <section className="rounded-3xl border border-[#22d3ee]/25 bg-[#0b1b20]/90 p-5 backdrop-blur-xl sm:p-6">
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#67e8f9]">
              Шинэ бүс
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Бүсээ тохируулах
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#9fb4bb]">
              Газрын зураг дээр цэгээ сонгоод нэр, радиусыг оруулна.
            </p>
          </div>

          <form action={action} className="grid gap-4">
            <input type="hidden" name="childId" value={childId} />
            <input
              type="hidden"
              name="latitude"
              value={point?.latitude ?? ""}
            />
            <input
              type="hidden"
              name="longitude"
              value={point?.longitude ?? ""}
            />

            {pointError && (
              <p role="alert" className="text-sm text-[#f87171]">
                {pointError}
              </p>
            )}

            <div>
              <label
                htmlFor="zone-name"
                className="text-[13px] font-semibold text-cyan-200"
              >
                Бүсийн нэр
              </label>
              <input
                id="zone-name"
                name="name"
                placeholder="Гэр, Сургууль…"
                maxLength={40}
                autoComplete="off"
                defaultValue={state?.values?.name}
                className={field}
              />
              {state?.errors?.name?.map((error) => (
                <p
                  key={error}
                  role="alert"
                  className="mt-2 text-sm text-[#f87171]"
                >
                  {error}
                </p>
              ))}
            </div>

            <div>
              <label
                htmlFor="zone-radius"
                className="text-[13px] font-semibold text-cyan-200"
              >
                Радиус
              </label>

              <div className="relative">
                <select
                  id="zone-radius"
                  name="radiusMeters"
                  value={radius}
                  onChange={(event) => setRadius(Number(event.target.value))}
                  className={`${field} appearance-none pr-10 cursor-pointer`}
                >
                  {RADIUS_OPTIONS.map((meters) => (
                    <option
                      key={meters}
                      value={meters}
                      className="bg-[#0b1b20] text-white"
                    >
                      {meters} м
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[#67e8f9]">
                  <ChevronDown className="size-5" />
                </div>
              </div>

              <p className="mt-2 text-xs leading-5 text-[#9fb4bb]">
                Бүсийн хэмжээ газрын зураг дээр тойргоор харагдана.
              </p>
            </div>

            {state?.message && (
              <p role="alert" className="text-sm text-[#f87171]">
                {state.message}
              </p>
            )}
            {state?.success && (
              <p role="status" className="text-sm text-[#34d399]">
                {state.success}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || !point}
              className="mt-1 inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#0891b2] px-5 text-sm font-semibold text-[#06212a] shadow-[0_4px_14px_rgba(6,182,212,0.4)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
            >
              {pending && <SafePathLoading variant="button" />}
              {pending ? "Хадгалж байна…" : "Аюулгүй бүс хадгалах"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-[#22d3ee]/25 bg-[#0b1b20]/90 p-5 backdrop-blur-xl sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">
                Хадгалсан бүсүүд
              </h2>
              <p className="mt-1 text-xs text-[#9fb4bb]">
                Нэр болон радиусыг нэг дороос харна.
              </p>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#22d3ee]/30 bg-[#0e7490]/30 text-sm font-semibold text-[#67e8f9]">
              {zones.length}
            </span>
          </div>

          {zones.length === 0 ? (
            <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-[#9fb4bb]">
              Одоогоор хадгалсан бүс алга. Эхний бүсээ газрын зургаас сонгож
              нэмээрэй.
            </p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {zones.map((zone) => (
                <li
                  key={zone.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0e7490]/30 text-[#67e8f9]">
                      <svg
                        viewBox="0 0 24 24"
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {zone.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#9fb4bb]">
                        Радиус · {zone.radiusMeters} м
                      </span>
                    </span>
                  </div>
                  <form action={removeZone} className="shrink-0">
                    <input type="hidden" name="zoneId" value={zone.id} />
                    <button
                      type="submit"
                      aria-label={`${zone.name} бүсийг устгах`}
                      className="min-h-10 rounded-lg px-3 text-xs font-medium text-[#f87171] transition hover:bg-red-500/20 hover:text-red-300"
                    >
                      Устгах
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
