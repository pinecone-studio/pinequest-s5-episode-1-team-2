import * as z from "zod";
import { zonesByChild } from "@/lib/child-zones";
import { checkReachedCheckpoints } from "@/lib/checkpoints";
import { createLowBatteryAlert, LOW_BATTERY_LEVEL, updateChildGeofenceState } from "@/lib/safety-alerts";
import { getCollections, isDuplicateKey } from "@/lib/db/mongo";
import type { ChildLocation, SeenLandmark, SharingState } from "@/types/location";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How many seen places a guardian's map shows per child. */
const SHOWN_LANDMARKS = 20;

/** What the child's phone sends. Any other fields in the request are dropped. */
export const LocationReportSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Metres. Wi-Fi or cell-tower positions can be a few km off; anything worse is not useful. */
  accuracy: z.number().min(0).max(100_000),
  /** How long ago the phone measured this position. An age, not a time, so a wrong phone clock does not matter. */
  ageMs: z.number().min(0).max(DAY_MS),
  /** Battery charge 0–1, when the phone's browser shares it. */
  batteryLevel: z.number().min(0).max(1).nullable().optional(),
  charging: z.boolean().nullable().optional(),
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
export async function saveChildLocation(childId: string, { ageMs, batteryLevel = null, charging = null, ...coordinates }: LocationReport) {
  const position = { ...coordinates, batteryLevel, charging };
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

  // Warn guardians while the phone can still report; its last position stays after it switches off.
  if (batteryLevel !== null && batteryLevel <= LOW_BATTERY_LEVEL && charging !== true) {
    try {
      await createLowBatteryAlert(childId, batteryLevel);
    } catch (error) {
      console.error("SAFEPATH_LOW_BATTERY_ALERT_FAILED", error);
    }
  }

  // A reached checkpoint is a reward, not a safety event: a failure here must not stop the geofence check.
  try {
    await checkReachedCheckpoints(childId, { ...position, updatedAt });
  } catch (error) {
    console.error("SAFEPATH_CHECKPOINT_CHECK_FAILED", error);
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
  const { users, locations, geofenceStates, seenLandmarks, scenePhotos } = await getCollections();
  await users.updateOne({ _id: childId }, { $set: { locationPaused: paused } });
  if (paused) {
    await Promise.all([
      locations.deleteOne({ _id: childId }),
      seenLandmarks.deleteMany({ childId }),
      scenePhotos.deleteMany({ childId }),
      // Resume starts from a fresh baseline so no movement during a pause is inferred.
      geofenceStates.deleteOne({ _id: childId }),
    ]);
  }
  return getSharingState(childId);
}

/** After a link is removed: a child nobody is linked to any more keeps no stored position or safe zones. */
export async function forgetUnwatchedChild(childId: string) {
  const { guardianLinks, locations, safeZones, geofenceStates, safetyAlerts, seenLandmarks, checkpoints, scenePhotos } = await getCollections();
  const watched = await guardianLinks.countDocuments({ childId }, { limit: 1 });
  if (!watched) {
    await Promise.all([
      locations.deleteOne({ _id: childId }),
      seenLandmarks.deleteMany({ childId }),
      scenePhotos.deleteMany({ childId }),
      // Goals set by a guardian who is no longer linked go too; rewards the child already earned stay.
      checkpoints.deleteMany({ childId }),
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
  const [children, positions, zones, landmarks, photos] = await Promise.all([
    users.find({ _id: { $in: childIds } }, { projection: { childName: 1, locationPaused: 1 } }).toArray(),
    locations.find({ _id: { $in: childIds } }).toArray(),
    zonesByChild(childIds),
    seenLandmarksByChild(childIds),
    latestPhotoByChild(childIds),
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
      name: child?.childName ?? "Хүүхэд",
      zones: zones.get(childId) ?? [],
      landmarks: paused ? [] : landmarks.get(childId) ?? [],
      photo: paused ? null : photos.get(childId) ?? null,
      paused,
      position: position
        ? {
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy,
            updatedAt: position.updatedAt.toISOString(),
            batteryLevel: position.batteryLevel ?? null,
            charging: position.charging ?? null,
          }
        : null,
    };
  });
}

/** The newest notable places each child's camera saw in the last day. */
async function seenLandmarksByChild(childIds: string[]): Promise<Map<string, SeenLandmark[]>> {
  const result = new Map<string, SeenLandmark[]>();
  if (!childIds.length) return result;
  const { seenLandmarks } = await getCollections();
  const records = await seenLandmarks
    .find({ childId: { $in: childIds }, seenAt: { $gte: new Date(Date.now() - DAY_MS) } })
    .sort({ seenAt: -1 })
    .toArray();
  for (const record of records) {
    const list = result.get(record.childId) ?? [];
    if (list.length >= SHOWN_LANDMARKS) continue;
    list.push({
      id: record._id,
      label: record.label,
      detail: record.detail,
      kind: record.kind,
      latitude: record.latitude,
      longitude: record.longitude,
      seenAt: record.seenAt.toISOString(),
    });
    result.set(record.childId, list);
  }
  return result;
}

/** The newest surroundings photo per child (id and time only; the image is fetched on its own). */
async function latestPhotoByChild(childIds: string[]): Promise<Map<string, { id: string; takenAt: string }>> {
  const result = new Map<string, { id: string; takenAt: string }>();
  if (!childIds.length) return result;
  const { scenePhotos } = await getCollections();
  const records = await scenePhotos
    .find({ childId: { $in: childIds }, takenAt: { $gte: new Date(Date.now() - DAY_MS) } }, { projection: { image: 0 } })
    .sort({ takenAt: -1 })
    .toArray();
  for (const record of records) {
    if (!result.has(record.childId)) result.set(record.childId, { id: record._id, takenAt: record.takenAt.toISOString() });
  }
  return result;
}
