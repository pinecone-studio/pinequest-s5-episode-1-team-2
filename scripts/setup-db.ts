import { getDb, getMongoClient } from "../src/lib/db/mongo";
import { applySchema } from "../src/lib/db/schema";

const client = await getMongoClient();
try {
  await applySchema(await getDb());
  console.log("MongoDB schema is up to date.");
} finally {
  await client.close();
}
