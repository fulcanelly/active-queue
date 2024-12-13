# Active Queue

Simple TypeScript-based task queue inspired by Active Job and Sidekiq.


### Setup 


### 1. Start redis & postgresql
### 2. Adjust your drizzle schema

```ts
export * from 'active-queue/schema'
```


And then

```sh
yarn drizzle-kit generate & yarn drizzle-kit migrate
```

### 3. Define your jobs 

`src/queue.config.ts`:
```ts
export const queue = makeQueue({
  namespace: 'test-queue',

  factories: {
    redis: _ => new Redis(),
    pg: _ => new Pool({
      connectionString: process.env.DATABASE_URL!
    }),
    sentry: _ => sentry, // you can also use sentryStub if you don't want it 
  },

  settings: {
    polling_interval: duration(10, 'second'),
    load_window: duration(3, 'seconds'),
    retry: { // or 'disabled'
      step: duration(2, 'seconds'),
      max_attempts: 30
    },
  },

  jobs: {
    async ok() {
      console.warn('* running ok *'.repeat(10))
    },

    async hmmm() {
      console.warn('* running hmmm() *'.repeat(10))      
    }

    /// ...
  }
})
```

### 4. Setup & start queue process

`src/queue.start.ts`: 
```ts  
import { queue } from "./queue";

void queue.start()
```

and

```bash
yarn tsx src/queue.start.ts
```

### 5. Use your jobs 
```ts
import { queue } from "./queue";

/// ... 

await queue.later().ok()
/// or 
await queue.in(duration(10, 'minutes')).ok()

// or for direct call without running in other process and for easier debugging
await queue.now().ok()
/// ...
```

