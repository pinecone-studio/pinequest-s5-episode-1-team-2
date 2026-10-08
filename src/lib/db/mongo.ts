import { MongoClient, type Db } from "mongodb";
import type { GuardianLink, PairingCode, RateLimit, UserRecord } from "@/types/auth";
import type { LocationRecord, SafeZoneRecord } from "@/types/location";

// Kept on globalThis so dev hot reloads reuse one connection instead of opening a new one each time.
const globalForMongo = globalThis as typeof globalThis & { mongoClient?: Promise<MongoClient> };

export function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");

  if (!globalForMongo.mongoClient) {
    const connecting = new MongoClient(uri).connect();
    // Do not keep a failed connection: the next call should try again.
    connecting.catch(() => {
      globalForMongo.mongoClient = undefined;
    });
    globalForMongo.mongoClient = connecting;
  }
  return globalForMongo.mongoClient;
}

export async function getDb(): Promise<Db> {
  return (await getMongoClient()).db(process.env.MONGODB_DB || "safepath");
}

export async function getCollections() {
  const db = await getDb();
  return {
    users: db.collection<UserRecord>("users"),
    guardianLinks: db.collection<GuardianLink>("guardianLinks"),
    pairingCodes: db.collection<PairingCode>("pairingCodes"),
    rateLimits: db.collection<RateLimit>("rateLimits"),
    locations: db.collection<LocationRecord>("locations"),
    safeZones: db.collection<SafeZoneRecord>("safeZones"),
  };
}

export function isDuplicateKey(error: unknown) {
  return (error as { code?: number } | null)?.code === 11000;
}
