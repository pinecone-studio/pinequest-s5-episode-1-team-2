import * as z from "zod";
import { getCollections } from "@/lib/db/mongo";
import { REWARD_IDS, type RewardId } from "@/types/rewards";
import type { Checkpoint, CheckpointRecord } from "@/types/location";

export const MAX_ACTIVE_CHECKPOINTS = 5;
export const CHECKPOINT_RADIUS_OPTIONS = [30, 50, 100, 200];
// A rough Wi-Fi or cell fix could "reach" a place the child never went to; only a GPS-quality fix counts.
const MAX_ACCURACY_METERS = 60;
// The child must stay inside this long, so walking past the edge or one jumpy reading does not count.
const DWELL_MS = 15_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const PICK_ON_MAP = "Газрын зураг дээр цэг сонгоно уу.";

const coordinate = (min: number, max: number) =>
  z
    .string({ error: PICK_ON_MAP })
    .trim()
    .min(1, { error: PICK_ON_MAP })
    .transform(Number)
    .pipe(z.number({ error: PICK_ON_MAP }).min(min, { error: PICK_ON_MAP }).max(max, { error: PICK_ON_MAP }));

/** The guardian's "add a checkpoint" form. */
export const CheckpointFormSchema = z.object({
  childId: z.string({ error: "Хүүхдээ сонгоно уу." }).min(1, { error: "Хүүхдээ сонгоно уу." }),
  name: z
    .string({ error: "Газрын нэрээ оруулна уу." })
    .trim()
    .min(1, { error: "Газрын нэрээ оруулна уу." })
    .max(40, { error: "Нэр хамгийн ихдээ 40 тэмдэгт байна." }),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  radiusMeters: z.coerce
    .number({ error: "Хэмжээг сонгоно уу." })
    .int({ error: "Хэмжээг сонгоно уу." })
    .min(30, { error: "Хэмжээг сонгоно уу." })
    .max(300, { error: "Хэмжээг сонгоно уу." }),
  reward: z.enum(REWARD_IDS, { error: "Шагналаа сонгоно уу." }),
});

export type CheckpointInput = z.infer<typeof CheckpointFormSchema>;

function toCheckpoint(record: CheckpointRecord): Checkpoint {
  return {
    id: record._id,
    name: record.name,
    latitude: record.latitude,
    longitude: record.longitude,
    radiusMeters: record.radiusMeters,
    reward: record.reward,
    reachedAt: record.reachedAt?.toISOString() ?? null,
  };
}

async function isLinked(guardianId: string, childId: string) {
  const { guardianLinks } = await getCollections();
  return (await guardianLinks.countDocuments({ guardianId, childId }, { limit: 1 })) > 0;
}

/** Adds a checkpoint for a child this guardian is linked to. */
export async function createCheckpoint(guardianId: string, { childId, ...checkpoint }: CheckpointInput): Promise<"ok" | "not-linked" | "too-many"> {
  if (!(await isLinked(guardianId, childId))) return "not-linked";
  const { checkpoints } = await getCollections();
  if ((await checkpoints.countDocuments({ childId, reachedAt: null })) >= MAX_ACTIVE_CHECKPOINTS) return "too-many";
  await checkpoints.insertOne({
    _id: crypto.randomUUID(),
    childId,
    ...checkpoint,
    insideSince: null,
    reachedAt: null,
    createdBy: guardianId,
    createdAt: new Date(),
  });
  return "ok";
}

/** Deletes a checkpoint if it belongs to a child this guardian is linked to. */
export async function deleteCheckpoint(guardianId: string, checkpointId: string) {
  const { checkpoints } = await getCollections();
  const checkpoint = await checkpoints.findOne({ _id: checkpointId });
  if (!checkpoint || !(await isLinked(guardianId, checkpoint.childId))) return false;
  await checkpoints.deleteOne({ _id: checkpointId });
  return true;
}

/** A child's open checkpoints, then those reached in the last 30 days, newest first. */
export async function listCheckpoints(childId: string): Promise<Checkpoint[]> {
  const { checkpoints } = await getCollections();
  const records = await checkpoints.find({ childId }).sort({ createdAt: -1 }).limit(30).toArray();
  return records
    .sort((a, b) => Number(a.reachedAt !== null) - Number(b.reachedAt !== null))
    .map(toCheckpoint);
}

/** What the child's own app shows: open goals, ones reached today (to celebrate), and what they own. */
export async function childCheckpointView(childId: string) {
  const { childRewards } = await getCollections();
  const [all, rewards] = await Promise.all([listCheckpoints(childId), childRewards.findOne({ _id: childId })]);
  const since = Date.now() - DAY_MS;
  return {
    checkpoints: all.filter((checkpoint) => !checkpoint.reachedAt || new Date(checkpoint.reachedAt).getTime() >= since),
    rewards: rewards?.items ?? [],
  };
}

/**
 * Called with each fresh location report. A checkpoint counts as reached only with a GPS-quality
 * fix inside it, held for a few seconds; then its reward is added to the child's collection.
 * Returns the checkpoints reached by this report.
 */
export async function checkReachedCheckpoints(
  childId: string,
  position: { latitude: number; longitude: number; accuracy: number; updatedAt: Date },
): Promise<Checkpoint[]> {
  const { checkpoints, childRewards } = await getCollections();
  const open = await checkpoints.find({ childId, reachedAt: null }).toArray();
  const reached: Checkpoint[] = [];

  for (const checkpoint of open) {
    const inside = position.accuracy <= MAX_ACCURACY_METERS && metersBetween(position, checkpoint) <= checkpoint.radiusMeters;

    if (!inside) {
      if (checkpoint.insideSince) await checkpoints.updateOne({ _id: checkpoint._id }, { $set: { insideSince: null } });
      continue;
    }
    if (!checkpoint.insideSince) {
      await checkpoints.updateOne({ _id: checkpoint._id, insideSince: null }, { $set: { insideSince: position.updatedAt } });
      continue;
    }
    if (position.updatedAt.getTime() - checkpoint.insideSince.getTime() < DWELL_MS) continue;

    // The reachedAt condition makes this idempotent if two reports race.
    const result = await checkpoints.updateOne({ _id: checkpoint._id, reachedAt: null }, { $set: { reachedAt: position.updatedAt } });
    if (!result.modifiedCount) continue;
    await grantReward(childId, checkpoint.reward);
    reached.push(toCheckpoint({ ...checkpoint, reachedAt: position.updatedAt }));
  }

  return reached;

  async function grantReward(id: string, reward: RewardId) {
    await childRewards.updateOne(
      { _id: id },
      { $addToSet: { items: reward }, $set: { updatedAt: new Date() } },
      { upsert: true },
    );
  }
}

/** Each child's checkpoints still to be reached, newest first. */
export async function openCheckpointsByChild(childIds: string[]): Promise<Map<string, Checkpoint[]>> {
  const result = new Map<string, Checkpoint[]>();
  if (!childIds.length) return result;
  const { checkpoints } = await getCollections();
  const records = await checkpoints.find({ childId: { $in: childIds }, reachedAt: null }).sort({ createdAt: -1 }).toArray();
  for (const record of records) {
    const list = result.get(record.childId) ?? [];
    list.push(toCheckpoint(record));
    result.set(record.childId, list);
  }
  return result;
}

function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
