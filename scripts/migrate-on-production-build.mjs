import process from "node:process";

if (process.env.RUN_DB_MIGRATIONS !== "true") {
  console.log("Database migrations are disabled during application builds; use npm run db:migrate:production from a dedicated release job.");
} else {
  await import("./migrate-production.mjs");
}
