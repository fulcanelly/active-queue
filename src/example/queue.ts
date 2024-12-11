import Redis from "ioredis"
import { makeQueue } from "../queue/index"
import { makeDrizzleInstance } from "../db"
import { duration } from "moment"


export const queue = makeQueue({
  namespace: 'testque',

  factories: {
    redis: _ => new Redis(),

    drizzle: _ => makeDrizzleInstance(),
    
    sentry: _ => null as any,
  },

  settings: {
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
    }
  }
})
