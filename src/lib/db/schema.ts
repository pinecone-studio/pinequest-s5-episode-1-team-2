import type { Db, Document, IndexDescription } from "mongodb";
import { NAME_MAX_LENGTH, PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH } from "@/lib/auth/schemas";
import { ROLES } from "@/types/auth";

type CollectionSchema = {
  validator: Document;
  indexes: IndexDescription[];
};

/**
 * What the database itself enforces, mirroring src/types/auth.ts.
 * `additionalProperties: false` rejects stray fields, so a bug cannot quietly store a plain password.
 * MongoDB has no foreign keys: deleting a user must also delete their guardianLinks and pairingCodes in code.
 */
export const SCHEMA: Record<string, CollectionSchema> = {
  users: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["email", "passwordHash", "name", "phone", "role", "createdAt"],
        additionalProperties: false,
        properties: {
          _id: { bsonType: "string" },
          // No uppercase letters: emails are stored lowercased, so the unique index is case-insensitive in practice.
          email: { bsonType: "string", pattern: "^[^\\p{Lu}]+$" },
          passwordHash: { bsonType: "string" },
          name: { bsonType: "string", minLength: 1, maxLength: NAME_MAX_LENGTH },
          phone: { bsonType: ["string", "null"] },
          role: { bsonType: ["string", "null"], enum: [...ROLES, null] },
          locationPaused: { bsonType: "bool" },
          createdAt: { bsonType: "date" },
        },
      },
    },
    indexes: [{ key: { email: 1 }, name: "email_unique", unique: true }],
  },
  guardianLinks: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["guardianId", "childId", "createdAt"],
        additionalProperties: false,
        properties: {
          _id: { bsonType: "string" },
          guardianId: { bsonType: "string" },
          childId: { bsonType: "string" },
          createdAt: { bsonType: "date" },
        },
      },
      $expr: { $ne: ["$guardianId", "$childId"] },
    },
    indexes: [
      { key: { guardianId: 1, childId: 1 }, name: "guardian_child_unique", unique: true },
      // "Who watches this child?"
      { key: { childId: 1 }, name: "childId" },
    ],
  },
  rateLimits: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["count", "resetAt"],
        additionalProperties: false,
        properties: {
          _id: { bsonType: "string" },
          count: { bsonType: "number" },
          resetAt: { bsonType: "date" },
        },
      },
    },
    // Old counters are removed in the background; the rate limiter also checks resetAt itself.
    indexes: [{ key: { resetAt: 1 }, name: "resetAt_ttl", expireAfterSeconds: 0 }],
  },
  locations: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["latitude", "longitude", "accuracy", "updatedAt"],
        additionalProperties: false,
        properties: {
          _id: { bsonType: "string" },
          latitude: { bsonType: "number", minimum: -90, maximum: 90 },
          longitude: { bsonType: "number", minimum: -180, maximum: 180 },
          accuracy: { bsonType: "number", minimum: 0 },
          updatedAt: { bsonType: "date" },
        },
      },
    },
    // A position nobody refreshed for a day is deleted, so a child's whereabouts are not kept forever.
    indexes: [{ key: { updatedAt: 1 }, name: "updatedAt_ttl", expireAfterSeconds: 24 * 60 * 60 }],
  },
  pairingCodes: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["code", "expiresAt"],
        additionalProperties: false,
        properties: {
          _id: { bsonType: "string" },
          code: { bsonType: "string", pattern: `^[${PAIRING_CODE_ALPHABET}]{${PAIRING_CODE_LENGTH}}$` },
          expiresAt: { bsonType: "date" },
        },
      },
    },
    indexes: [
      { key: { code: 1 }, name: "code_unique", unique: true },
      // MongoDB removes expired codes in the background, about once a minute,
      // so redeeming must still check expiresAt.
      { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
    ],
  },
};

/** Creates the collections and indexes, or brings existing ones up to date. Safe to run again. */
export async function applySchema(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));

  for (const [name, { validator, indexes }] of Object.entries(SCHEMA)) {
    if (existing.has(name)) {
      await db.command({ collMod: name, validator });
    } else {
      await db.createCollection(name, { validator });
    }
    await db.collection(name).createIndexes(indexes);
  }
}
