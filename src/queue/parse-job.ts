import { queuedActiveJobTable } from "schema";
import superjson from "superjson";
import { JobEntry } from ".";

export function parseJob(job: typeof queuedActiveJobTable.$inferSelect): JobEntry {
  const args = superjson.parse(job.jobArgs);
  const name = job.jobName;

  return {
    id: job.id,
    args,
    name,
    shouldRunAt: job.shouldRunAt!
  };
}
