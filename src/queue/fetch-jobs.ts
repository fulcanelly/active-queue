import { and, eq, lt } from "drizzle-orm";
import { JobEntry } from ".";
import { parseJob } from "./parse-job";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { queuedActiveJobTable } from "~@schema";

export async function* fetchJobsToExec({ namespace, load_window, db }: { namespace: string; load_window: number; db: NodePgDatabase }): AsyncGenerator<JobEntry> {
  const jobsToExec = await db.select()
    .from(queuedActiveJobTable)
    .where(
      and(
        eq(queuedActiveJobTable.status, 'queued'),
        eq(queuedActiveJobTable.namespace, namespace),
        lt(queuedActiveJobTable.shouldRunAt, Date.now() + load_window),
      )
    );

  for (const job of jobsToExec) {
    yield parseJob(job);
  }
}
