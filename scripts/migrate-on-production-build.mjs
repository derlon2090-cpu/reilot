import process from "node:process";

const shouldMigrate = process.env.VERCEL_ENV === "production"
  || process.env.RUN_DB_MIGRATIONS === "true";

if (!shouldMigrate) {
  console.log("Skipping database migrations outside the production build.");
} else if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the production database migration");
} else {
  await import("./migrate.mjs");
  // Render owns the server-side AI secret. Verify it with one tiny provider
  // request during deployment so a missing, expired, or unusable key can never
  // be promoted silently. The smoke script logs status and token counts only.
  if (process.env.RENDER === "true" || process.env.RENDER_SERVICE_ID) {
    await import("./smoke-deepseek.mjs");
  }
  if (process.env.ADMIN_BOOTSTRAP_ON_BUILD === "true") {
    await import("./bootstrap-admin.mjs");
  }
}
