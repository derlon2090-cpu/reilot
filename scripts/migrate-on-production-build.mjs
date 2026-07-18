import process from "node:process";

const shouldMigrate = process.env.VERCEL_ENV === "production"
  || process.env.RUN_DB_MIGRATIONS === "true";

if (!shouldMigrate) {
  console.log("Skipping database migrations outside the production build.");
} else if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the production database migration");
} else {
  await import("./migrate.mjs");
}
