import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type LedgerTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type LedgerReader = Pick<typeof db, "select">;

/**
 * Serialize ledger writes within a workspace, including accountless rows that
 * can later be assigned to accounts. Acquire before receipt, occurrence, or
 * transaction row locks, and read reconciliation state only after acquisition.
 *
 * An advisory lock avoids locking the workspace row (and its FK checks). The
 * transaction releases it on commit/rollback; hash collisions only serialize
 * unrelated workspaces. READ COMMITTED gives waiting writers fresh state.
 */
export async function lockWorkspaceLedger(tx: LedgerTransaction, workspaceId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`sika:ledger:${workspaceId}`}, 0))`,
  );
}
