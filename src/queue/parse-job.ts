import superjson from "superjson";
import { JobEntry } from ".";
import { queuedActiveJobTable } from "~@schema";

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
