import { eq, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { queuedActiveJobTable } from "~@schema";

export function wrapJob({ id, db }: { id: number, db: NodePgDatabase }) {
  async function load() {
    const it = await db.select()
      .from(queuedActiveJobTable)
      .where(
        eq(queuedActiveJobTable.id, id)
      );
    return it[0]!;
  }

  return {
    load,

    async markAsDone() {
      await db.update(queuedActiveJobTable)
        .set({
          status: 'done',
          attempts: sql`attempts + 1`,
          executedAt: Date.now(),
          updatedAt: Date.now(),
        })
        .where(
          eq(queuedActiveJobTable.id, id)
        );
    },

    async markAsExecuting() {
      await db.update(queuedActiveJobTable)
        .set({
          status: 'executing',
          updatedAt: Date.now(),
        })
        .where(
          eq(queuedActiveJobTable.id, id)
        );
    },

    async markAsFailed() {
      await db.update(queuedActiveJobTable)
        .set({
          status: 'failed',
          attempts: sql`attempts + 1`,
          executedAt: Date.now(),
          updatedAt: Date.now(),
        })
        .where(
          eq(queuedActiveJobTable.id, id)
        );
    },
  };
}
