import { integer, pgTable, varchar, text, bigint, pgEnum } from "drizzle-orm/pg-core";


export const queuedActiveJobStatusEnumValues = [
  'queued',
  'executing',
  'done',
  'failed',
] as const

export const queuedActiveJobStatusEnum
  = pgEnum('QueuedActiveJobStatus', queuedActiveJobStatusEnumValues)

export type QueuedActiveJobStatus = (typeof queuedActiveJobStatusEnumValues)[number]


export const queuedActiveJobTable = pgTable("QueuedActiveJob", {
  id: integer()
    .primaryKey()
    .generatedAlwaysAsIdentity(),

  namespace: varchar({ length: 255 }).notNull(),

  jobName: text().notNull(),
  jobArgs: text().notNull(),

  status: queuedActiveJobStatusEnum().notNull(),

  shouldRunAt: bigint({mode: 'number'}).notNull(),

  executedAt: bigint({ mode: 'number' }),

  updatedAt: bigint({ mode: 'number' }).notNull(),
  createdAt: bigint({ mode: 'number' }).notNull(),

});

