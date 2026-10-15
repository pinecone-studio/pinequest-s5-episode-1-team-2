import * as z from "zod";
import { getCollections } from "@/lib/db/mongo";
import { getSharingState } from "@/lib/location-sharing";
import { SCENE_LANDMARK_KINDS } from "@/types/vision";

const DAY_MS = 24 * 60 * 60 * 1000;
// Rough half-width of a phone's rear camera view in portrait, as in the AR camera.
const CAMERA_HALF_FOV_DEGREES = 28;
// How far ahead of the child a seen place is drawn. Only a hint of direction; the camera cannot measure distance.
const PROJECT_METERS = 30;
// The same name seen again this close counts as the same place, not a new one.
const SAME_PLACE_METERS = 150;
const MAX_PER_CHILD = 50;

/** What the child's camera sends after the AI picked out notable places. Other fields are dropped. */
export const SeenLandmarkReportSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Compass heading of the camera in degrees, when the phone has one. */
  heading: z.number().min(0).max(360).nullable(),
  landmarks: z.array(z.object({
    label: z.string().trim().min(1).max(48),
    detail: z.string().trim().max(80),
    kind: z.enum(SCENE_LANDMARK_KINDS),
    box: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
  })).min(1).max(2),
});

export type SeenLandmarkReport = z.infer<typeof SeenLandmarkReportSchema>;

/**
 * Keeps the notable places the child passed, so guardians see them on the map. Like positions,
 * nothing is stored while sharing is paused or no guardian is linked.
 */
export async function saveSeenLandmarks(childId: string, report: SeenLandmarkReport) {
  const state = await getSharingState(childId);
  if (state.paused || state.watchers === 0) return { saved: 0 };

  const { seenLandmarks } = await getCollections();
  const seenAt = new Date();
  const recent = await seenLandmarks.find({ childId, seenAt: { $gte: new Date(seenAt.getTime() - DAY_MS) } }).toArray();

  let saved = 0;
  for (const landmark of report.landmarks) {
    const position = placeOf(report, landmark.box);
    const same = recent.find((existing) =>
      existing.label.toLocaleLowerCase("mn") === landmark.label.toLocaleLowerCase("mn")
      && metersBetween(existing, position) < SAME_PLACE_METERS);
    if (same) {
      await seenLandmarks.updateOne({ _id: same._id }, { $set: { seenAt, detail: landmark.detail, ...position } });
    } else {
      await seenLandmarks.insertOne({ _id: crypto.randomUUID(), childId, label: landmark.label, detail: landmark.detail, kind: landmark.kind, ...position, seenAt });
    }
    saved += 1;
  }

  // Keep only the newest places per child.
  const overflow = await seenLandmarks.find({ childId }, { projection: { _id: 1 } }).sort({ seenAt: -1 }).skip(MAX_PER_CHILD).toArray();
  if (overflow.length) await seenLandmarks.deleteMany({ _id: { $in: overflow.map(({ _id }) => _id) } });

  return { saved };
}

/** A short way from the child toward where the place sat in the frame; the child's own spot without a compass. */
function placeOf(report: SeenLandmarkReport, box: SeenLandmarkReport["landmarks"][number]["box"]) {
  const origin = { latitude: report.latitude, longitude: report.longitude };
  if (report.heading === null) return origin;
  const centerX = box ? (box[1] + box[3]) / 2 : 500;
  const bearing = report.heading + ((centerX / 1000) - 0.5) * 2 * CAMERA_HALF_FOV_DEGREES;
  return project(origin, bearing, PROJECT_METERS);
}

function project(from: { latitude: number; longitude: number }, bearingDegrees: number, meters: number) {
  const radius = 6_371_000;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const deg = (radians: number) => (radians * 180) / Math.PI;
  const angular = meters / radius;
  const bearing = rad(bearingDegrees);
  const lat1 = rad(from.latitude);
  const lon1 = rad(from.longitude);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: deg(lat2), longitude: ((deg(lon2) + 540) % 360) - 180 };
}

function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
