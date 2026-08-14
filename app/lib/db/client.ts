import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

export type QueueDatabase = ReturnType<typeof createDatabase>;

type DatabaseSingleton = {
  queueDatabase?: QueueDatabase;
};

const singleton = globalThis as typeof globalThis & DatabaseSingleton;

/**
 * Lazily creates the Neon client so importing schemas, templates, or tests never
 * requires DATABASE_URL and never opens a connection.
 */
export function getDatabase(): QueueDatabase {
  if (singleton.queueDatabase) return singleton.queueDatabase;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for a database operation.");
  }

  singleton.queueDatabase = createDatabase(connectionString);
  return singleton.queueDatabase;
}
