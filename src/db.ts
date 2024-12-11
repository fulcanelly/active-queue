import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';

export const makeDrizzleInstance = () =>
  drizzle(process.env.DATABASE_URL!, {
    logger: true,
  });


