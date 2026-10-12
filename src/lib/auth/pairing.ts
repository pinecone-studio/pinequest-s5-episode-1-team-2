import { randomInt } from "node:crypto";
import { getCollections, isDuplicateKey } from "@/lib/db/mongo";
import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_CODE_TTL_MINUTES } from "@/lib/auth/schemas";
import { forgetUnwatchedChild } from "@/lib/location-sharing";

function randomCode() {
  return Array.from({ length: PAIRING_CODE_LENGTH }, () => PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)]).join("");
}

/** Gives the child a fresh code, replacing any code they already had. */
export async function createPairingCode(childId: string) {
  const { pairingCodes } = await getCollections();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MINUTES * 60_000);
    try {
      await pairingCodes.replaceOne({ _id: childId }, { code, expiresAt }, { upsert: true });
      return { code, expiresAt };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error; // another child holds this exact code: draw again
    }
  }
  throw new Error("Could not create a pairing code.");
}

/** Uses up the code and links the guardian to its child. Returns the child's id, or null. */
export async function redeemPairingCode(code: string, guardianId: string) {
  const { pairingCodes, guardianLinks } = await getCollections();
  const found = await pairingCodes.findOneAndDelete({ code, expiresAt: { $gt: new Date() } });
  if (!found || found._id === guardianId) return null;
  try {
    await guardianLinks.insertOne({ _id: crypto.randomUUID(), guardianId, childId: found._id, createdAt: new Date() });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error; // already linked
  }
  return found._id;
}

/** Links an account to itself, so the guardian phone and child phone of one account see each other. */
export async function linkToSelf(userId: string) {
  const { guardianLinks } = await getCollections();
  try {
    await guardianLinks.insertOne({ _id: crypto.randomUUID(), guardianId: userId, childId: userId, createdAt: new Date() });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error; // already linked
  }
}

/** Shown for a child who has not set a name in settings yet. */
export const CHILD_PLACEHOLDER_NAME = "Хүүхэд";

export type LinkedPerson = { linkId: string; name: string };

/** The children a guardian watches (side "guardian") or the guardians watching a child (side "child"). */
export async function listLinkedPeople(userId: string, side: "guardian" | "child"): Promise<LinkedPerson[]> {
  const { guardianLinks, users } = await getCollections();
  const mine = side === "guardian" ? "guardianId" : "childId";
  const theirs = side === "guardian" ? "childId" : "guardianId";
  const links = await guardianLinks.find({ [mine]: userId }).sort({ createdAt: 1 }).toArray();
  const people = await users.find({ _id: { $in: links.map((link) => link[theirs]) } }, { projection: { name: 1, phone: 1, childName: 1, childPhone: 1 } }).toArray();
  // The child side of a link shows the child's own name and phone.
  const asChild = side === "guardian";
  const details = new Map(
    people.map((person) => [
      person._id,
      {
        // `name` and `phone` are the guardian's, so a child with none of its own set must not show them.
        name: asChild ? (person.childName ?? CHILD_PLACEHOLDER_NAME) : person.name,
        phone: asChild ? (person.childPhone ?? null) : person.phone,
      },
    ]),
  );
  return links.map((link) => {
    const person = details.get(link[theirs]);
    return { linkId: link._id, name: person?.name ?? "—", phone: person?.phone ?? null };
  });
}

/** Either side may end a link. Returns whether something was removed. */
export async function removeLink(linkId: string, userId: string) {
  const { guardianLinks } = await getCollections();
  const removed = await guardianLinks.findOneAndDelete({ _id: linkId, $or: [{ guardianId: userId }, { childId: userId }] });
  if (!removed) return false;
  await forgetUnwatchedChild(removed.childId);
  return true;
}
