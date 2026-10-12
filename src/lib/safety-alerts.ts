import { getDistanceMeters } from "@/lib/geofence";
import { getCollections, isDuplicateKey } from "@/lib/db/mongo";
import type { GuardianSafetyAlert, SafetyAlertRecord, SafetyAlertType } from "@/types/alerts";
import type { SafeZoneRecord } from "@/types/location";
import { sendSafetyAlertPush } from "@/lib/push/firebase";

const MAX_ALERTS = 50;

/**
 * Re-evaluates the child's configured safe zones after a fresh location arrives.
 * A small GPS-accuracy buffer avoids repeated exit/enter alerts at the boundary.
 */
export async function updateChildGeofenceState(
  childId: string,
  position: { latitude: number; longitude: number; accuracy: number; updatedAt: Date },
): Promise<number> {
  const { guardianLinks, safeZones, geofenceStates, safetyAlerts } = await getCollections();
  const linkedGuardians = await guardianLinks.countDocuments({ childId }, { limit: 1 });
  if (!linkedGuardians) {
    await geofenceStates.deleteOne({ _id: childId });
    return 0;
  }

  const zones = await safeZones.find({ childId }).sort({ createdAt: 1 }).toArray();
  if (zones.length === 0) {
    await geofenceStates.deleteOne({ _id: childId });
    return 0;
  }

  const previous = await geofenceStates.findOne({ _id: childId });
  const previousZone = previous?.isInside && previous.insideZoneId
    ? zones.find((zone) => zone._id === previous.insideZoneId) ?? null
    : null;
  // If the active zone was deleted, treat this reading as a fresh baseline; a settings
  // change should not produce a misleading "child left the zone" alert.
  const activeZoneWasRemoved = Boolean(previous?.isInside && previous.insideZoneId && !previousZone);

  const marginMeters = Math.max(25, Math.min(position.accuracy, 100));
  const confidentlyInside = zones.find((zone) =>
    getDistanceMeters(position.latitude, position.longitude, zone.latitude, zone.longitude) + marginMeters
      <= zone.radiusMeters,
  ) ?? null;

  let insideZone: SafeZoneRecord | null = confidentlyInside;
  if (!insideZone && previous?.isInside && previousZone) {
    const distance = getDistanceMeters(
      position.latitude,
      position.longitude,
      previousZone.latitude,
      previousZone.longitude,
    );
    // Hysteresis: do not change to "outside" while still within the accuracy buffer.
    if (distance <= previousZone.radiusMeters + marginMeters) insideZone = previousZone;
  }

  const isInside = insideZone !== null;
  const priorStateIsComparable = Boolean(previous) && !activeZoneWasRemoved;
  let type: SafetyAlertType | null = null;
  let zoneName: string | undefined;
  let message = "";

  if (priorStateIsComparable && previous) {
    if (previous.isInside && !isInside) {
      type = "ZONE_EXIT";
      zoneName = previousZone?.name;
      message = `${zoneName ?? "Аюулгүй бүс"} бүсээс гарсан байна.`;
    } else if (!previous.isInside && isInside) {
      type = "ZONE_ENTER";
      zoneName = insideZone?.name;
      message = `${zoneName ?? "Аюулгүй"} бүсэд орлоо.`;
    }
  } else if (!previous && !isInside) {
    // Initial baseline outside every configured zone is important context too. The state
    // prevents repeated alerts until the child enters a zone and later leaves again.
    type = "OUTSIDE_SAFE_ZONES";
    message = "Хүүхдийн эхний шинэ байршил тохируулсан аюулгүй бүсүүдийн гадна байна.";
  }

  let alertCreated = 0;
  if (type) {
    // Key the event to the state version that triggered it. If two location requests
    // overlap, MongoDB's unique index prevents both from creating the same transition.
    const priorVersion = previous?.updatedAt instanceof Date
      ? String(previous.updatedAt.getTime())
      : `initial-${position.updatedAt.getTime()}`;
    const alert: SafetyAlertRecord = {
      _id: crypto.randomUUID(),
      childId,
      type,
      transitionKey: `${childId}:${priorVersion}:${type}`,
      ...(zoneName ? { zoneName } : {}),
      message,
      createdAt: position.updatedAt,
      readBy: [],
    };
    try {
      // Persist the safety event before advancing state, so an event-write failure can
      // be retried by the next fresh report rather than silently losing the alert.
      await safetyAlerts.insertOne(alert);
      alertCreated = 1;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // Another overlapping request already wrote this same transition.
    }

    if (alertCreated) {
      try {
        await sendSafetyAlertPush(childId, { alertId: alert._id, type: alert.type, message: alert.message });
      } catch {
        // The in-app event remains saved even when FCM or network delivery is unavailable.
        console.error("SAFEPATH_GEOFENCE_PUSH_DELIVERY_FAILED");
      }
    }
  }

  await geofenceStates.replaceOne(
    { _id: childId },
    {
      childId,
      isInside,
      insideZoneId: insideZone?._id ?? null,
      updatedAt: position.updatedAt,
    },
    { upsert: true },
  );

  return alertCreated;
}

/** Lists alerts only for children linked to the authenticated guardian. */
export async function listGuardianSafetyAlerts(guardianId: string): Promise<GuardianSafetyAlert[]> {
  const { guardianLinks, users, safetyAlerts } = await getCollections();
  const links = await guardianLinks.find({ guardianId }).toArray();
  const childIds = [...new Set(links.map((link) => link.childId))];
  if (childIds.length === 0) return [];

  const [events, children] = await Promise.all([
    safetyAlerts.find({ childId: { $in: childIds } }).sort({ createdAt: -1 }).limit(MAX_ALERTS).toArray(),
    users.find({ _id: { $in: childIds } }, { projection: { name: 1 } }).toArray(),
  ]);
  const names = new Map(children.map((child) => [child._id, child.name]));

  return events.map((event) => ({
    id: event._id,
    childId: event.childId,
    childName: names.get(event.childId) ?? "Хүүхэд",
    type: event.type,
    zoneName: event.zoneName ?? null,
    message: event.message,
    createdAt: event.createdAt.toISOString(),
    read: event.readBy.includes(guardianId),
  }));
}

/** Marks an alert read only if this guardian is still linked to that child. */
export async function markGuardianSafetyAlertRead(
  guardianId: string,
  alertId: string,
): Promise<"ok" | "not-found" | "not-linked"> {
  const { guardianLinks, safetyAlerts } = await getCollections();
  const alert = await safetyAlerts.findOne({ _id: alertId });
  if (!alert) return "not-found";

  const linked = await guardianLinks.countDocuments(
    { guardianId, childId: alert.childId },
    { limit: 1 },
  );
  if (!linked) return "not-linked";

  await safetyAlerts.updateOne({ _id: alertId }, { $addToSet: { readBy: guardianId } });
  return "ok";
}


/** Creates an explicit SOS alert for every currently linked guardian.
 * The alert deliberately stores no coordinates; guardians can use the existing
 * authenticated live-location feed to see the most recent shared position.
 */
export async function createChildSosAlert(
  childId: string,
): Promise<"created" | "no-guardians"> {
  const { guardianLinks, safetyAlerts } = await getCollections();
  const linkedGuardians = await guardianLinks.countDocuments({ childId }, { limit: 1 });
  if (!linkedGuardians) return "no-guardians";

  const now = new Date();
  const alert: SafetyAlertRecord = {
    _id: crypto.randomUUID(),
    childId,
    type: "SOS",
    transitionKey: `sos:${childId}:${crypto.randomUUID()}`,
    message: "Хүүхэд яаралтай тусламж хүссэн. Боломжтой бол хүүхэдтэй шууд холбогдож, SafePath дээрх хамгийн сүүлийн байршлыг шалгана уу.",
    createdAt: now,
    readBy: [],
  };

  await safetyAlerts.insertOne(alert);
  try {
    await sendSafetyAlertPush(childId, { alertId: alert._id, type: alert.type, message: alert.message });
  } catch {
    // SOS is still stored in the in-app feed; push failure must not erase the event.
    console.error("SAFEPATH_SOS_PUSH_DELIVERY_FAILED");
  }
  return "created";
}
