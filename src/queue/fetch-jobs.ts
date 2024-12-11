import { and, eq, lt, sql, gt } from "drizzle-orm";
import { JobEntry } from ".";
import { parseJob } from "./parse-job";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { queuedActiveJobTable } from "~@schema";
import { duration } from "moment";

export async function* fetchJobsToExec({ namespace, load_window, db }: {
  namespace: string;
  load_window: number;
  db: NodePgDatabase
}): AsyncGenerator<JobEntry> {
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

export async function* fetchJobToRetry({
  db,
  max_attempts,
  retry_step,
  namespace
}: {
  db: NodePgDatabase,
  max_attempts: number | undefined,
  retry_step: number,
  namespace: string,
}) {

  const failed_jobs = db.$with('failed_jobs')
    .as(
      db.select()
        .from(queuedActiveJobTable)
        .where(
          and(
            eq(queuedActiveJobTable.namespace, namespace),
            eq(queuedActiveJobTable.status, 'failed'),
            sql`"executedAt" + (${retry_step} * attempts) < ${Date.now()}`,
          )
        )
    )

  const jobsToRetry = max_attempts ?
    db.with(failed_jobs)
      .select()
      .from(failed_jobs)
      .where(
        sql`attempts < ${max_attempts}`,
      )
    :
    db.with(failed_jobs)
      .select()
      .from(queuedActiveJobTable)

  for (const job of await jobsToRetry) {
    console.error("AAAA")
    console.log(job.attempts * retry_step, 'ms')
    console.log(duration(job.attempts * retry_step, 'ms').humanize())

    yield parseJob(job);
  }
}
