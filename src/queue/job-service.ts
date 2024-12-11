import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { queuedActiveJobTable, QueuedActiveJobStatus } from "schema";


export function wrapJob({ id, db }: { id: number, db: NodePgDatabase }) {
  async function load() {
    const it = await db.select()
      .from(queuedActiveJobTable)
      .where(
        eq(queuedActiveJobTable.id, id)
      );
    return it[0]!;
  }

  async function updateStaus(status: QueuedActiveJobStatus) {
    await db.update(queuedActiveJobTable)
      .set({
        status,
        executedAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(
        eq(queuedActiveJobTable.id, id)
      );
  }

  return {
    load,
    markAsDone() {
      return updateStaus('done');
    },

    markAsExecuting() {
      return updateStaus('executing');
    },

    markAsFailed() {
      return updateStaus('failed');
    },
  };
}
