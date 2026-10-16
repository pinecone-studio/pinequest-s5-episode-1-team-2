import { Binary } from "mongodb";
import * as z from "zod";
import { getCollections } from "@/lib/db/mongo";
import { getSharingState } from "@/lib/location-sharing";

/** Only the newest few photos are kept per child; older ones are deleted at once. */
const KEEP_PER_CHILD = 5;
/** A 640 px JPEG is well under this; anything larger is not a camera snapshot from the app. */
const MAX_IMAGE_BYTES = 400_000;

/** What the child's camera sends when it opens. Other fields are dropped. */
export const ScenePhotoReportSchema = z.object({
  image: z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type ScenePhotoReport = z.infer<typeof ScenePhotoReportSchema>;

/**
 * Stores the surroundings photo the child's camera took when it opened, so guardians can see
 * where the child is. Like positions, nothing is kept while sharing is paused or nobody is linked.
 */
export async function saveScenePhoto(childId: string, report: ScenePhotoReport): Promise<"saved" | "paused" | "no-guardian" | "too-large"> {
  const state = await getSharingState(childId);
  if (state.paused) return "paused";
  if (state.watchers === 0) return "no-guardian";

  const bytes = Buffer.from(report.image.slice(report.image.indexOf(",") + 1), "base64");
  if (bytes.length > MAX_IMAGE_BYTES) return "too-large";

  const { scenePhotos } = await getCollections();
  await scenePhotos.insertOne({
    _id: crypto.randomUUID(),
    childId,
    image: new Binary(bytes),
    latitude: report.latitude,
    longitude: report.longitude,
    takenAt: new Date(),
  });

  const old = await scenePhotos.find({ childId }, { projection: { _id: 1 } }).sort({ takenAt: -1 }).skip(KEEP_PER_CHILD).toArray();
  if (old.length) await scenePhotos.deleteMany({ _id: { $in: old.map(({ _id }) => _id) } });
  return "saved";
}

/** A guardian's view of one photo, only for a child linked to them. */
export async function readScenePhoto(guardianId: string, childId: string, photoId: string) {
  const { guardianLinks, scenePhotos } = await getCollections();
  if (!(await guardianLinks.countDocuments({ guardianId, childId }, { limit: 1 }))) return null;
  const photo = await scenePhotos.findOne({ _id: photoId, childId });
  return photo ? Buffer.from(photo.image.buffer) : null;
}
