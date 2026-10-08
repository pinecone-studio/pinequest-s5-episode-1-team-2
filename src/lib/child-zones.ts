import * as z from "zod";
import { getCollections } from "@/lib/db/mongo";
import type { SafeZone } from "@/types/safety";

export const MAX_ZONES_PER_CHILD = 10;

const PICK_ON_MAP = "Газрын зураг дээр цэг сонгоно уу.";

/** A coordinate from a hidden form field. Empty means no point was picked on the map. */
const coordinate = (min: number, max: number) =>
  z
    .string({ error: PICK_ON_MAP })
    .trim()
    .min(1, { error: PICK_ON_MAP })
    .transform(Number)
    .pipe(z.number({ error: PICK_ON_MAP }).min(min, { error: PICK_ON_MAP }).max(max, { error: PICK_ON_MAP }));

/** The "add a safe zone" form. */
export const ZoneFormSchema = z.object({
  childId: z.string({ error: "Хүүхдээ сонгоно уу." }).min(1, { error: "Хүүхдээ сонгоно уу." }),
  name: z
    .string({ error: "Бүсийн нэрээ оруулна уу." })
    .trim()
    .min(1, { error: "Бүсийн нэрээ оруулна уу." })
    .max(40, { error: "Нэр хамгийн ихдээ 40 тэмдэгт байна." }),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  radiusMeters: z.coerce
    .number({ error: "Бүсийн хэмжээг сонгоно уу." })
    .int({ error: "Бүсийн хэмжээг сонгоно уу." })
    .min(50, { error: "Бүсийн хэмжээг сонгоно уу." })
    .max(2000, { error: "Бүсийн хэмжээг сонгоно уу." }),
});

export type ZoneInput = z.infer<typeof ZoneFormSchema>;

/** Each child's safe zones, oldest first. Every requested child gets an entry, even with no zones. */
export async function zonesByChild(childIds: string[]): Promise<Map<string, SafeZone[]>> {
  const { safeZones } = await getCollections();
  const docs = await safeZones.find({ childId: { $in: childIds } }).sort({ createdAt: 1 }).toArray();
  const result = new Map<string, SafeZone[]>(childIds.map((childId) => [childId, []]));
  for (const doc of docs) {
    result.get(doc.childId)?.push({ id: doc._id, name: doc.name, latitude: doc.latitude, longitude: doc.longitude, radiusMeters: doc.radiusMeters });
  }
  return result;
}

async function isLinked(guardianId: string, childId: string) {
  const { guardianLinks } = await getCollections();
  return (await guardianLinks.countDocuments({ guardianId, childId }, { limit: 1 })) > 0;
}

/** Adds a zone for a child this guardian is linked to. */
export async function createZone(guardianId: string, { childId, ...zone }: ZoneInput): Promise<"ok" | "not-linked" | "too-many"> {
  if (!(await isLinked(guardianId, childId))) return "not-linked";
  const { safeZones } = await getCollections();
  if ((await safeZones.countDocuments({ childId })) >= MAX_ZONES_PER_CHILD) return "too-many";
  await safeZones.insertOne({ _id: crypto.randomUUID(), childId, ...zone, createdBy: guardianId, createdAt: new Date() });
  return "ok";
}

/** Deletes a zone if it belongs to a child this guardian is linked to. Returns whether it was deleted. */
export async function deleteZone(guardianId: string, zoneId: string) {
  const { safeZones } = await getCollections();
  const zone = await safeZones.findOne({ _id: zoneId });
  if (!zone || !(await isLinked(guardianId, zone.childId))) return false;
  await safeZones.deleteOne({ _id: zoneId });
  return true;
}
