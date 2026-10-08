import { getCollections } from "@/lib/db/mongo";

/**
 * Counts one attempt for `key` and says whether it is still allowed.
 * The counter lives in MongoDB, so it works across serverless instances.
 */
export async function allowAttempt(key: string, limit: number, windowMs: number) {
  const { rateLimits } = await getCollections();
  const now = new Date();
  const open = { $gt: ["$resetAt", now] };
  const entry = await rateLimits.findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          count: { $cond: [open, { $add: ["$count", 1] }, 1] },
          resetAt: { $cond: [open, "$resetAt", new Date(now.getTime() + windowMs)] },
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );
  return (entry?.count ?? 1) <= limit;
}
