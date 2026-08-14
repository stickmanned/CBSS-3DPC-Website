import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit's CLI only auto-loads .env, not .env.local, so local development
// would otherwise need DATABASE_URL exported into the shell by hand.
loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ quiet: true });

export default defineConfig({
  schema: "./app/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  strict: true,
  verbose: true,
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: process.env.DATABASE_URL } }
    : {}),
});
