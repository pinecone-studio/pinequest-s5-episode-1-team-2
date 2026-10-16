import Link from "next/link";
import { CheckpointEditor } from "@/components/checkpoint-editor";
import { ChildTabs, GuardianScreen } from "@/components/guardian-screen";
import { requireRole } from "@/lib/auth/dal";
import { listCheckpoints } from "@/lib/checkpoints";
import { listChildLocations } from "@/lib/location-sharing";

/** A point passed in the address (from a tap on the guardian's home map), if it is a real coordinate. */
function pointFrom(lat?: string | string[], lng?: string | string[]) {
  const latitude = Number(Array.isArray(lat) ? lat[0] : lat);
  const longitude = Number(Array.isArray(lng) ? lng[0] : lng);
  if (!lat || !lng || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export default async function CheckpointsPage({ searchParams }: { searchParams: Promise<{ child?: string | string[]; lat?: string | string[]; lng?: string | string[] }> }) {
  const guardian = await requireRole("guardian");
  const children = await listChildLocations(guardian.id);
  const { child: wanted, lat, lng } = await searchParams;
  const initialPoint = pointFrom(lat, lng);
  const selected = children.find((child) => child.childId === wanted) ?? children[0];
  const checkpoints = selected ? await listCheckpoints(selected.childId) : [];

  return (
    <GuardianScreen title="Шалгах цэг">
      {!selected ? (
        <div className="rounded-2xl border border-(--sp-line) bg-(--sp-surface) p-5">
          <p className="text-base font-semibold">Шалгах цэг өгөхийн тулд эхлээд хүүхдээ холбоно уу.</p>
          <Link href="/guardian/link" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-(--sp-primary) px-5 text-sm font-semibold text-white">Хүүхэд холбох</Link>
        </div>
      ) : (
        <>
          <ChildTabs items={children} selectedId={selected.childId} hrefFor={(childId) => `/guardian/checkpoints?child=${childId}`} />
          <CheckpointEditor
            key={selected.childId}
            childId={selected.childId}
            childName={selected.name}
            zones={selected.zones}
            checkpoints={checkpoints}
            initialPoint={initialPoint}
            childPosition={selected.position && { latitude: selected.position.latitude, longitude: selected.position.longitude }}
          />
        </>
      )}
    </GuardianScreen>
  );
}
