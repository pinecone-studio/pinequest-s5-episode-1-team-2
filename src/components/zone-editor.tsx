"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { SafePathLoading } from "@/components/safepath-loading";
import { addZone, removeZone } from "@/app/actions/zones";
import type { FormState } from "@/types/auth";
import type { SafeZone } from "@/types/safety";

const ZoneMap = dynamic(() => import("@/components/zone-map"), {
  ssr: false,
  loading: () => <SafePathLoading className="h-full" label="Газрын зураг ачаалж байна…" />,
});

type Point = { latitude: number; longitude: number };

const RADIUS_MIN = 50;
const RADIUS_MAX = 1000;
const RADIUS_STEP = 25;
const RADIUS_PRESETS = [100, 200, 300, 500];
/** Where the map starts when there is nothing else to show: central Ulaanbaatar. */
const DEFAULT_CENTER: Point = { latitude: 47.9186, longitude: 106.9176 };
const field = "mt-2 h-12 w-full rounded-xl border border-(--sp-line) bg-black/40 px-4 text-[16px] text-(--sp-ink) outline-none transition placeholder:text-(--sp-muted) focus:border-(--sp-primary) focus:ring-2 focus:ring-(--sp-primary-soft)";

/** "Аюулгүй бүс N" with the first number not already used, so new zones get tidy default names. */
function nextZoneName(zones: SafeZone[]) {
  const taken = new Set(zones.map((zone) => zone.name.trim()));
  let number = zones.length + 1;
  for (let candidate = 1; candidate <= zones.length + 1; candidate += 1) {
    if (!taken.has(`Аюулгүй бүс ${candidate}`)) {
      number = candidate;
      break;
    }
  }
  return `Аюулгүй бүс ${number}`;
}

function formatRadius(meters: number) {
  return meters < 1000 ? `${meters} м` : `${(meters / 1000).toFixed(1)} км`;
}

/** Lets a guardian place a zone in two steps: tap one point on the map, then size it with the slider. */
export function ZoneEditor({ childId, childName, zones, childPosition, initialPoint = null }: {
  childId: string;
  childName: string;
  zones: SafeZone[];
  childPosition: Point | null;
  initialPoint?: Point | null;
}) {
  const [point, setPoint] = useState<Point | null>(initialPoint);
  const [radius, setRadius] = useState(200);
  const [locating, setLocating] = useState(false);
  const defaultName = nextZoneName(zones);
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
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-2xl border border-(--sp-line) bg-(--sp-surface)">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold">1. Газраа сонгох</h2>
            <p className="mt-0.5 text-xs leading-5 text-(--sp-muted)">
              {point ? "Цэг сонгогдлоо. Өөр газар дарвал цэг шилжинэ." : "Газрын зураг дээр нэг цэг дарж бүсийн төвийг сонгоно уу."}
            </p>
          </div>
          <button type="button" onClick={pickMyLocation} disabled={locating} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-(--sp-line) px-3 text-xs font-semibold text-(--sp-primary) transition hover:bg-(--sp-primary-soft) disabled:opacity-50">
            {locating && <SafePathLoading variant="button" />}{locating ? "Тогтоож байна…" : "📍 Миний байршил"}
          </button>
        </div>
        <div className="h-[44vh] min-h-[280px] max-h-[460px] overflow-hidden">
          <ZoneMap center={center} zones={zones} draft={point} draftRadius={radius} childPosition={childPosition} onPick={(latitude, longitude) => setPoint({ latitude, longitude })} />
        </div>
      </section>

      <section className={`rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-4 transition-opacity ${point ? "" : "opacity-60"}`}>
        <h2 className="text-[15px] font-semibold">2. Хэмжээ ба нэр</h2>
        <form action={action} className="mt-3 grid gap-4">
          <input type="hidden" name="childId" value={childId} />
          <input type="hidden" name="latitude" value={point?.latitude ?? ""} />
          <input type="hidden" name="longitude" value={point?.longitude ?? ""} />
          <input type="hidden" name="radiusMeters" value={radius} />
          {pointError && <p role="alert" className="text-sm text-(--sp-risk)">{pointError}</p>}

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="zone-radius" className="text-[13px] font-semibold text-(--sp-muted)">Радиус</label>
              <span className="text-[17px] font-bold text-(--sp-safe)">{formatRadius(radius)}</span>
            </div>
            <input
              id="zone-radius"
              type="range"
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              step={RADIUS_STEP}
              value={radius}
              disabled={!point}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="mt-3 w-full accent-(--sp-safe) disabled:opacity-50"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {RADIUS_PRESETS.map((meters) => (
                <button
                  key={meters}
                  type="button"
                  disabled={!point}
                  onClick={() => setRadius(meters)}
                  className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-50 ${radius === meters ? "border-(--sp-safe) bg-(--sp-safe-bg) text-(--sp-safe)" : "border-(--sp-line) text-(--sp-muted) hover:text-(--sp-ink)"}`}
                >
                  {meters} м
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-(--sp-muted)">Бүсийн хүрээ газрын зураг дээр тойргоор шууд харагдана.</p>
          </div>

          <div>
            <label htmlFor="zone-name" className="text-[13px] font-semibold text-(--sp-muted)">Бүсийн нэр</label>
            <input key={defaultName} id="zone-name" name="name" maxLength={40} autoComplete="off" defaultValue={state?.values?.name ?? defaultName} className={field} />
            <p className="mt-1.5 text-xs text-(--sp-muted)">Хүсвэл «Гэр», «Сургууль» гэж өөрчилж болно.</p>
            {state?.errors?.name?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-(--sp-risk)">{error}</p>)}
          </div>

          {state?.message && <p role="alert" className="text-sm text-(--sp-risk)">{state.message}</p>}
          {state?.success && <p role="status" className="text-sm text-(--sp-safe)">{state.success}</p>}
          <button type="submit" disabled={pending || !point} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-(--sp-primary) px-5 text-sm font-semibold text-white transition hover:bg-(--sp-primary-deep) disabled:cursor-not-allowed disabled:bg-(--sp-line) disabled:text-(--sp-muted)">
            {pending && <SafePathLoading variant="button" />}{pending ? "Хадгалж байна…" : point ? "Аюулгүй бүс хадгалах" : "Эхлээд газрын зураг дээр цэг сонгоно уу"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Хадгалсан бүсүүд · {childName}</h2>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--sp-primary-soft) text-sm font-semibold">{zones.length}</span>
        </div>
        {zones.length === 0 ? (
          <p className="mt-3 rounded-xl bg-black/30 px-3 py-3 text-sm leading-6 text-(--sp-muted)">Одоогоор бүс алга. Эхний бүсээ газрын зургаас сонгож нэмээрэй.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {zones.map((zone) => (
              <li key={zone.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-(--sp-line) px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-(--sp-safe-bg) text-(--sp-safe)" aria-hidden="true">🛡️</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{zone.name}</span>
                    <span className="mt-0.5 block text-xs text-(--sp-muted)">Радиус · {formatRadius(zone.radiusMeters)}</span>
                  </span>
                </div>
                <form action={removeZone} className="shrink-0">
                  <input type="hidden" name="zoneId" value={zone.id} />
                  <button type="submit" aria-label={`Устгах: ${zone.name}`} className="min-h-9 rounded-lg px-3 text-xs font-medium text-(--sp-muted) transition hover:bg-(--sp-risk-bg) hover:text-(--sp-risk)">Устгах</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
