import * as z from "zod";
import { zonesByChild } from "@/lib/child-zones";
import { updateChildGeofenceState } from "@/lib/safety-alerts";
import { getCollections, isDuplicateKey } from "@/lib/db/mongo";
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
  const { locations, geofenceStates, safetyAlerts } = await getCollections();
  const state = await getSharingState(childId);
  if (state.paused || state.watchers === 0) {
    await Promise.all([
      locations.deleteOne({ _id: childId }),
      geofenceStates.deleteOne({ _id: childId }),
      ...(state.watchers === 0 ? [safetyAlerts.deleteMany({ childId })] : []),
    ]);
    return { ...state, shared: false, geofenceCheck: "skipped" as const };
  }

  const updatedAt = new Date(Date.now() - ageMs);
  // The timestamp condition is part of the MongoDB write, so concurrent delayed reports
  // cannot overwrite a newer sample between a separate read and write.
  try {
    await locations.updateOne(
      {
        _id: childId,
        $or: [
          { updatedAt: { $lte: updatedAt } },
          { updatedAt: { $exists: false } },
        ],
      },
      { $set: { ...position, updatedAt } },
      { upsert: true },
    );
  } catch (error) {
    // With upsert enabled, a newer existing _id makes the conditional update miss and
    // MongoDB reports the attempted duplicate _id. Leave that newer position untouched.
    if (isDuplicateKey(error)) {
      return { ...state, shared: true, geofenceCheck: "skipped-stale-report" as const, alertsCreated: 0 };
    }
    throw error;
  }

  // Old cached readings may refresh the UI's "last updated" timestamp, but they must not
  // generate a fresh safety event. Only geofence-check a location measured in the last 2 min.
  if (ageMs > 120_000) {
    return { ...state, shared: true, geofenceCheck: "skipped-stale-reading" as const, alertsCreated: 0 };
  }

  try {
    const alertsCreated = await updateChildGeofenceState(childId, { ...position, updatedAt });
    return { ...state, shared: true, geofenceCheck: "ok" as const, alertsCreated };
  } catch (error) {
    console.error("SAFEPATH_GEOFENCE_CHECK_FAILED", error);
    return { ...state, shared: true, geofenceCheck: "failed" as const, alertsCreated: 0 };
  }
}

/** Pausing also deletes the stored position at once, so guardians stop seeing it immediately. */
export async function setSharingPaused(childId: string, paused: boolean): Promise<SharingState> {
  const { users, locations, geofenceStates } = await getCollections();
  await users.updateOne({ _id: childId }, { $set: { locationPaused: paused } });
  if (paused) {
    await Promise.all([
      locations.deleteOne({ _id: childId }),
      // Resume starts from a fresh baseline so no movement during a pause is inferred.
      geofenceStates.deleteOne({ _id: childId }),
    ]);
  }
  return getSharingState(childId);
}

/** After a link is removed: a child nobody is linked to any more keeps no stored position or safe zones. */
export async function forgetUnwatchedChild(childId: string) {
  const { guardianLinks, locations, safeZones, geofenceStates, safetyAlerts } = await getCollections();
  const watched = await guardianLinks.countDocuments({ childId }, { limit: 1 });
  if (!watched) {
    await Promise.all([
      locations.deleteOne({ _id: childId }),
      safeZones.deleteMany({ childId }),
      geofenceStates.deleteOne({ _id: childId }),
      safetyAlerts.deleteMany({ childId }),
    ]);
  }
}

/** The children linked to this guardian, oldest link first, each with their latest position if they are sharing. */
export async function listChildLocations(guardianId: string): Promise<ChildLocation[]> {
  const { guardianLinks, users, locations } = await getCollections();
  const links = await guardianLinks.find({ guardianId }).sort({ createdAt: 1 }).toArray();
  const childIds = links.map((link) => link.childId);
  const [children, positions, zones] = await Promise.all([
    users.find({ _id: { $in: childIds } }, { projection: { name: 1, childName: 1, locationPaused: 1 } }).toArray(),
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
      name: child?.childName ?? child?.name ?? "—",
      zones: zones.get(childId) ?? [],
      paused,
      position: position
        ? { latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy, updatedAt: position.updatedAt.toISOString() }
        : null,
    };
  });
}
