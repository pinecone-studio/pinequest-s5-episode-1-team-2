import * as z from "zod";
import { getCollections } from "@/lib/db/mongo";

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the child's phone sends. Any other fields in the request are dropped. */
export const LocationReportSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Metres. Wi-Fi or cell-tower positions can be a few km off; anything worse is not useful. */
  accuracy: z.number().min(0).max(100_000),
  /** How long ago the phone measured this position. An age, not a time, so a wrong phone clock does not matter. */
  ageMs: z.number().min(0).max(DAY_MS),
});

export type LocationReport = z.infer<typeof LocationReportSchema>;

/**
 * Keeps the child's latest position. A child no guardian is linked to shares nothing:
 * the position is not stored, and an old one is removed. Returns whether it was stored.
 */
export async function saveChildLocation(childId: string, { ageMs, ...position }: LocationReport) {
  const { guardianLinks, locations } = await getCollections();
  const watched = await guardianLinks.countDocuments({ childId }, { limit: 1 });
  if (!watched) {
    await locations.deleteOne({ _id: childId });
    return false;
  }

  await locations.replaceOne({ _id: childId }, { ...position, updatedAt: new Date(Date.now() - ageMs) }, { upsert: true });
  return true;
}
