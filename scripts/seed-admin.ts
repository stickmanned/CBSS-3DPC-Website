import { config as loadEnvironment } from "dotenv";
import { z } from "zod";
import { createDatabase } from "../app/lib/db/client";
import { adminUser } from "../app/lib/db/schema";

loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ quiet: true });

const optionNames = ["github-id", "login", "name"] as const;
type OptionName = (typeof optionNames)[number];
type Options = Partial<Record<OptionName, string>>;

class SeedInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedInputError";
  }
}

function isOptionName(value: string): value is OptionName {
  return optionNames.includes(value as OptionName);
}

function parseArguments(args: readonly string[]): Options {
  const values: Options = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) {
      throw new SeedInputError(`Unexpected argument: ${argument}`);
    }

    const separator = argument.indexOf("=");
    const rawName = argument.slice(2, separator === -1 ? undefined : separator);
    if (!isOptionName(rawName)) {
      throw new SeedInputError(`Unknown option: --${rawName}`);
    }
    if (values[rawName] !== undefined) {
      throw new SeedInputError(`Option supplied more than once: --${rawName}`);
    }

    const value = separator === -1 ? args[index + 1] : argument.slice(separator + 1);
    if (!value || value.startsWith("--")) {
      throw new SeedInputError(`Missing value for --${rawName}`);
    }
    values[rawName] = value;
    if (separator === -1) index += 1;
  }

  return values;
}

const githubLoginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(39)
  .regex(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d]))*$/, "must be a valid GitHub login");

const seedConfigurationSchema = z.object({
  databaseUrl: z
    .string()
    .trim()
    .url()
    .refine(
      (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
      "must be a Postgres URL",
    ),
  githubId: z.string().trim().regex(/^\d{1,30}$/, "must be the stable numeric GitHub account ID"),
  githubLogin: githubLoginSchema,
  displayName: z.string().trim().min(1).max(120),
});

async function seedAdmin() {
  const options = parseArguments(process.argv.slice(2));
  const parsed = seedConfigurationSchema.safeParse({
    databaseUrl: process.env.DATABASE_URL,
    githubId: options["github-id"] ?? process.env.ADMIN_GITHUB_ID,
    githubLogin: options.login ?? process.env.ADMIN_GITHUB_LOGIN,
    displayName: options.name ?? process.env.ADMIN_DISPLAY_NAME,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new SeedInputError(
      `Invalid seed configuration (${details}). Set DATABASE_URL and ADMIN_GITHUB_ID, ADMIN_GITHUB_LOGIN, and ADMIN_DISPLAY_NAME, or pass --github-id, --login, and --name.`,
    );
  }

  const { databaseUrl, githubId, githubLogin, displayName } = parsed.data;
  const database = createDatabase(databaseUrl);

  try {
    const existingAdmins = await database
      .select({ githubId: adminUser.githubId, githubLogin: adminUser.githubLogin })
      .from(adminUser);
    const conflictingLogin = existingAdmins.find(
      (admin) =>
        admin.githubLogin.toLowerCase() === githubLogin && admin.githubId !== githubId,
    );
    if (conflictingLogin) {
      throw new SeedInputError(
        "That GitHub login is already assigned to a different numeric account ID. Resolve the allowlist entry manually before retrying.",
      );
    }

    await database
      .insert(adminUser)
      .values({ githubId, githubLogin, displayName, active: true })
      .onConflictDoUpdate({
        target: adminUser.githubId,
        set: { githubLogin, displayName, active: true, updatedAt: new Date() },
      });

    console.log("Admin allowlist entry added or updated.");
  } finally {
    await database.$client.end();
  }
}

seedAdmin().catch((error: unknown) => {
  const message =
    error instanceof SeedInputError
      ? error.message
      : "The database operation failed. Check DATABASE_URL, network access, and the migration state.";
  console.error(`Admin seed failed: ${message}`);
  process.exitCode = 1;
});
