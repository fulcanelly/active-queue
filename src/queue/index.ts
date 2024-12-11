import Redis from "ioredis"
import { Duration } from "moment";
import { parseJob } from "./parse-job";
import { fetchJobsToExec } from "./fetch-jobs";
import { wrapJob } from "./job-service";
import { addJob } from "./add-job";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { SentryLike } from "../sentry-adapter";

type NullValue = void | undefined | null

type QueueJobs<J extends string, A> = {
  [T in J]: (args: A) => Promise<NullValue> | NullValue
}

export function getChanKey(namespace: string) {
  return `:active-queue:${namespace}`
}

export type JobEntry = {
  id: number,
  args: any,
  name: string,
  shouldRunAt: number
}


type Settings = {
  polling_interval: Duration
  load_window: Duration


  // retry: {
  //   enabled: boolean,
  //   max_attempts: undefined | number,
  // }

}



type Factories = {
  redis(any?): Redis
  drizzle(any?): NodePgDatabase
  sentry(any?): SentryLike
}



export type EnrollNotification = {
  id: number,
  shouldRunAt: number
}


export function makeQueue<
  N extends string,
  A,
  J extends QueueJobs<N, A>
>({
  jobs,
  namespace,
  factories,
  settings,
}: {
  jobs: J,
  namespace: string,
  factories: Factories,
  settings: Settings
}) {
  const loadedJobs = new Map<number, NodeJS.Timeout>()

  const redis = factories.redis()
  const db = factories.drizzle()

  function prepareJobForExecution(job: JobEntry) {
    if (loadedJobs.has(job.id)) {
      return console.warn('ignoring already loaded job - ' + job.id)
    }


    const wrappedJob = wrapJob({ id: job.id, db })

    const delay = job.shouldRunAt - Date.now()

    console.warn({ delay })

    const callableJob = async () => {
      await wrappedJob.markAsExecuting()

      console.warn(` * [active queue] [start executing job] :: ${job.name}`)

      try {
        await jobs[job.name](job.args)
        await wrappedJob.markAsDone()
      } catch (e) {
        // TODO sentry
        await wrappedJob.markAsFailed()
      } finally {
        console.warn(` * [active queue] [done executing job] :: ${job.name}`)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const timeout = setTimeout(callableJob, delay)
    loadedJobs.set(job.id, timeout)
  }


  return {
    now() {
      return jobs
    },

    later() {
      return new Proxy(jobs, {
        get: (_, jobName: string) => (jobArgs: any) => addJob({
          namespace,

          jobArgs, jobName,

          shouldRunAt: Date.now(),

          redis, db,
        })
      }) as J
    },

    in(duration: Duration) {
      const shouldRunAt = Date.now() + duration.asMilliseconds()

      return new Proxy(jobs, {
        get: (_, jobName: string) => (jobArgs: any) => addJob({
          namespace,

          jobArgs, jobName,

          shouldRunAt,

          redis, db,
        })
      }) as J
    },

    async start() {
      const subredis = redis.duplicate()
      await subredis.subscribe(getChanKey(namespace))

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      subredis.on('message', async (channel, msg) => {
        console.warn({ channel, msg })
        const parsedMsg = JSON.parse(msg) as EnrollNotification

        if (parsedMsg.shouldRunAt < Date.now() + settings.load_window.asMilliseconds()) {
          const job = await wrapJob({ id: parsedMsg.id, db }).load()
          prepareJobForExecution(parseJob(job))
        }

      })

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setInterval(async () => {
        console.error(' * [active queue] [polling] trying to load jobs')

        const fetchParams = {
          namespace,
          load_window: settings.load_window.asMilliseconds(),
          db
        }

        for await (const job of fetchJobsToExec(fetchParams)) {
          await prepareJobForExecution(job)
        }
      }, settings.polling_interval.asMilliseconds())

    }
  }

}




