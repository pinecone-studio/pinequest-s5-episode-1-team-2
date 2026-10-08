import * as z from "zod";
import { zonesByChild } from "@/lib/child-zones";
import { getCollections } from "@/lib/db/mongo";
import type { ChildLocation, SharingState } from "@/types/location";

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

/** The child's pause switch. */
export const SharingUpdateSchema = z.object({ paused: z.boolean() });

/** Whether the child paused sharing, and how many guardians are linked to them. */
export async function getSharingState(childId: string): Promise<SharingState> {
  const { guardianLinks, users } = await getCollections();
  const [watchers, child] = await Promise.all([
    guardianLinks.countDocuments({ childId }),
    users.findOne({ _id: childId }, { projection: { locationPaused: 1 } }),
  ]);
  return { paused: child?.locationPaused === true, watchers };
}

/**
 * Keeps the child's latest position, unless nobody may see it: while sharing is paused or no
 * guardian is linked, nothing is stored and any old position is removed.
 */
export async function saveChildLocation(childId: string, { ageMs, ...position }: LocationReport) {
  const { locations } = await getCollections();
  const state = await getSharingState(childId);
  if (state.paused || state.watchers === 0) {
    await locations.deleteOne({ _id: childId });
    return { ...state, shared: false };
  }

  await locations.replaceOne({ _id: childId }, { ...position, updatedAt: new Date(Date.now() - ageMs) }, { upsert: true });
  return { ...state, shared: true };
}

/** Pausing also deletes the stored position at once, so guardians stop seeing it immediately. */
export async function setSharingPaused(childId: string, paused: boolean): Promise<SharingState> {
  const { users, locations } = await getCollections();
  await users.updateOne({ _id: childId }, { $set: { locationPaused: paused } });
  if (paused) await locations.deleteOne({ _id: childId });
  return getSharingState(childId);
}

/** After a link is removed: a child nobody is linked to any more keeps no stored position or safe zones. */
export async function forgetUnwatchedChild(childId: string) {
  const { guardianLinks, locations, safeZones } = await getCollections();
  const watched = await guardianLinks.countDocuments({ childId }, { limit: 1 });
  if (!watched) await Promise.all([locations.deleteOne({ _id: childId }), safeZones.deleteMany({ childId })]);
}

/** The children linked to this guardian, oldest link first, each with their latest position if they are sharing. */
export async function listChildLocations(guardianId: string): Promise<ChildLocation[]> {
  const { guardianLinks, users, locations } = await getCollections();
  const links = await guardianLinks.find({ guardianId }).sort({ createdAt: 1 }).toArray();
  const childIds = links.map((link) => link.childId);
  const [children, positions, zones] = await Promise.all([
    users.find({ _id: { $in: childIds } }, { projection: { name: 1, locationPaused: 1 } }).toArray(),
    locations.find({ _id: { $in: childIds } }).toArray(),
    zonesByChild(childIds),
  ]);
  const byId = new Map(children.map((child) => [child._id, child]));
  const latest = new Map(positions.map((position) => [position._id, position]));

  return childIds.map((childId) => {
    const child = byId.get(childId);
    const paused = child?.locationPaused === true;
    // A report that raced the pause could still have been stored; never show it while paused.
    const position = paused ? undefined : latest.get(childId);
    return {
      childId,
      name: child?.name ?? "—",
      zones: zones.get(childId) ?? [],
      paused,
      position: position
        ? { latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy, updatedAt: position.updatedAt.toISOString() }
        : null,
    };
  });
}
