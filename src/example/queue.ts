import Redis from "ioredis"
import { makeQueue } from "../queue/index"
import { duration } from "moment"
import { Pool } from "pg"
import { sentryStub } from "~@sentry-adapter"


export const queue = makeQueue({
  namespace: 'test-queue',

  factories: {
    redis: _ => new Redis(),

    pg: _ => new Pool({
      connectionString: process.env.DATABASE_URL!
    }),

    sentry: _ => sentryStub,
  },

  settings: {
    retry: {
      step: duration(2, 'seconds'),
      max_attempts: 30
    },

    polling_interval: duration(10, 'second'),
    load_window: duration(3, 'seconds'),
  },

  jobs: {
    // eslint-disable-next-line @typescript-eslint/require-await
    async ok() {
      console.error('* running ok *'.repeat(10))
    },

    // eslint-disable-next-line @typescript-eslint/require-await
    async hmmm() {
      console.error('* running hmmm() *'.repeat(10))
    },

    // eslint-disable-next-line @typescript-eslint/require-await
    async shouldFail() {
      throw new Error('fail')
    }
  }
})

