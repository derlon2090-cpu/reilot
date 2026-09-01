import process from "node:process";

if (process.env.RUN_DB_MIGRATIONS !== "true") {
  throw new Error("RUN_DB_MIGRATIONS=true is required for the dedicated production migration job");
}
if (!process.env.MIGRATION_RELEASE_ID?.trim()) {
  throw new Error("MIGRATION_RELEASE_ID is required for an auditable production migration job");
}

console.log(`Starting dedicated migration release ${process.env.MIGRATION_RELEASE_ID.trim().slice(0, 120)}`);
await import("./migrate.mjs");
