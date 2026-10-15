import { loadEnvConfig } from "@next/env";
import { getDb, getMongoClient } from "../src/lib/db/mongo";
import { applySchema } from "../src/lib/db/schema";

// Outside Next.js nothing reads .env.local, so load it the same way Next does (MONGODB_URI lives there).
loadEnvConfig(process.cwd());

async function main() {
  const client = await getMongoClient();

  try {
    await applySchema(await getDb());
    console.log("MongoDB schema is up to date.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Database setup failed:", error);
  process.exitCode = 1;
});
