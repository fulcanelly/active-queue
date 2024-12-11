import Redis from "ioredis"
import { queuedActiveJobTable } from "../schema";
import superjson from 'superjson';
import { EnrollNotification, getChanKey } from ".";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function addJob({ namespace, jobArgs, jobName, shouldRunAt, redis, db }: {
  namespace: string,
  jobName: string,
  jobArgs: any,
  shouldRunAt: number,
  redis: Redis,
  db: NodePgDatabase
}) {

  console.warn(` * [active queue] queueing job <-> ${jobName}`)


  const jobEntry = {
    namespace,
    jobName,
    jobArgs: superjson.stringify(jobArgs),
    shouldRunAt,
  }

  const it = await db.insert(queuedActiveJobTable)
    .values({
      ...jobEntry,

      status: 'queued',
      shouldRunAt,

      createdAt: Date.now(),
      updatedAt: Date.now()
    })
    .returning()

  await redis.publish(getChanKey(namespace), JSON.stringify({
    id: it[0].id,
    shouldRunAt: it[0].shouldRunAt
  } as EnrollNotification))

}
