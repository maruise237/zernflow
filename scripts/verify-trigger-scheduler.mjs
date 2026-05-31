import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`${label} is missing ${JSON.stringify(needle)}`);
  }
}

const migration = read("supabase/migrations/00014_atomic_scheduler_claims.sql");
const jobsRoute = read("app/api/cron/jobs/route.ts");
const sequenceProcessor = read("lib/sequence-processor.ts");
const databaseTypes = read("lib/types/database.ts");
const packageJson = read("package.json");
const dokployDocs = read("docs/dokploy-schedules.md");

assertContains(migration.toLowerCase(), "for update skip locked", "scheduler migration");
assertContains(migration, "claim_due_scheduled_jobs", "scheduler migration");
assertContains(migration, "claim_due_sequence_enrollments", "scheduler migration");
assertContains(jobsRoute, '.rpc("claim_due_scheduled_jobs"', "jobs cron route");
assertContains(sequenceProcessor, "claim_due_sequence_enrollments", "sequence processor");
assertContains(sequenceProcessor, 'status: "active"', "sequence processor failure recovery");
assertContains(databaseTypes, '"processing"', "database types");
assertContains(packageJson, '"cron:jobs"', "package scripts");
assertContains(packageJson, '"cron:sequences"', "package scripts");
assertContains(dokployDocs, "Application Job", "Dokploy docs");

console.log("trigger scheduler verification passed");
