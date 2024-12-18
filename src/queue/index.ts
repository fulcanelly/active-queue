import Redis from "ioredis"
import { Duration } from "moment";
import { parseJob } from "./parse-job";
import { fetchJobsToExec, fetchJobToRetry } from "./fetch-jobs";
import { wrapJob } from "./job-service";
import { addJob } from "./add-job";
import { SentryLike } from "../sentry-adapter";
import { art } from "~@art";
import { Pool } from "pg";
import { drizzle } from 'drizzle-orm/node-postgres';


type NullValue = void | undefined | null | unknown


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


  retry: {
    max_attempts: undefined | number,
    step: Duration
  }
  | 'disabled'

}


type Factories = {
  redis(any?): Redis
  pg(any?): Pool
  sentry(any?): SentryLike
}



export type EnrollNotification = {
  id: number,
  shouldRunAt: number
}


type QueueJobs = {
  [T in string]: (args: any) => Promise<NullValue> | NullValue
}

type AsyncQueuedJobs<T extends QueueJobs> = {
  [K in keyof T]: (args: Parameters<T[K]>[0]) => Promise<NullValue>
}


export function makeQueue<
  J extends QueueJobs
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
  const db = drizzle(factories.pg(), { logger: true })

  const poll = async () => {
    console.error(' * [active queue] [polling] trying to load jobs')

    const fetchParams = {
      namespace, db,
      load_window: settings.load_window.asMilliseconds(),
    }

    for await (const job of fetchJobsToExec(fetchParams)) {
      prepareJobForExecution(job)
    }
  }


  const pollFailed = async () => {
    console.error(' * [active queue] [polling failed] trying to load failed jobs')

    if (settings.retry === 'disabled') {
      return
    }

    const fetchParams = {
      namespace, db,

      max_attempts: settings.retry.max_attempts,
      retry_step: settings.retry.step.asMilliseconds()
    }

    for await (const job of fetchJobToRetry(fetchParams)) {
      prepareJobForExecution(job)
    }

  }

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
        console.error(e)
        await wrappedJob.markAsFailed()
      } finally {
        console.warn(` * [active queue] [done executing job] :: ${job.name}`)
        loadedJobs.delete(job.id)
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
      }) as AsyncQueuedJobs<J>
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
      }) as AsyncQueuedJobs<J>
    },

    async start() {
      console.log(art)
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

      if (settings.retry !== 'disabled') {

        void pollFailed()
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        setInterval(pollFailed, settings.retry.step.asMilliseconds())
      }

      void poll()
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setInterval(poll, settings.polling_interval.asMilliseconds())

    }
  }

}




