import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import type { LedgerTransaction } from "./ledger-lock";
import { transactionUpdateSchema } from "./validation";

type Client = typeof import("@/db/client");
type Schema = typeof import("@/db/schema");
type Lock = typeof import("./ledger-lock");
let db: Client["db"];
let schema: Schema;
let lock: Lock["lockWorkspaceLedger"];
let accounts: typeof import("./financial-accounts");
let money: typeof import("./transactions");
let recurring: typeof import("@/lib/recurring-money-occurrences");
let schedules: typeof import("./recurring-outgoings");

it("ordinary PATCH validation cannot manufacture reconciled status", () => {
  assert.throws(
    () => transactionUpdateSchema.parse({ status: "reconciled" }),
    /only be reconciled through account reconciliation/,
  );
  assert.equal(transactionUpdateSchema.parse({ status: "pending" }).status, "pending");
  assert.equal(transactionUpdateSchema.parse({ status: "cleared" }).status, "cleared");
  assert.deepEqual(transactionUpdateSchema.parse({ notes: "Reviewed" }), { notes: "Reviewed" });
});

describe("reconciliation serialization", {
  skip: !process.env.DATABASE_URL && "requires isolated DATABASE_URL",
}, () => {
  before(async () => {
    const [client, tables, locking, accountService, transactionService, occurrenceService, scheduleService] =
      await Promise.all([
        import("@/db/client"), import("@/db/schema"), import("./ledger-lock"),
        import("./financial-accounts"), import("./transactions"),
        import("@/lib/recurring-money-occurrences"), import("./recurring-outgoings"),
      ]);
    db = client.db;
    schema = tables;
    lock = locking.lockWorkspaceLedger;
    accounts = accountService;
    money = transactionService;
    recurring = occurrenceService;
    schedules = scheduleService;
  });

  async function fixture() {
    const userId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, name: "Race", email: `${userId}@example.com` });
    await db.insert(schema.workspaces).values({
      id: workspaceId, userId, name: "Race", type: "personal", currency: "GBP",
    });
    const account = await accounts.create(workspaceId, {
      name: "Bank", accountClass: "asset", accountType: "checking", currency: "GBP",
      openingBalance: 100, openingDate: "2026-01-01",
    });
    return { userId, workspaceId, account };
  }

  // Observe an actual PostgreSQL lock wait, not a timing assumption. Commit the
  // winning operation only once the losing service call is blocked on our lock.
  async function race<T>(
    workspaceId: string,
    operation: () => Promise<T>,
    winner: (tx: LedgerTransaction) => Promise<void>,
  ) {
    let outcome!: Promise<{ value: T } | { error: unknown }>;
    try {
      await db.transaction(async (tx) => {
        await lock(tx, workspaceId);
        const pidResult = await tx.execute(sql`select pg_backend_pid() as pid`);
        const pid = Number(pidResult.rows[0].pid);
        outcome = operation().then((value) => ({ value }), (error: unknown) => ({ error }));
        const deadline = Date.now() + 5000;
        for (;;) {
          const waiting = await db.execute(sql`
            select pid from pg_stat_activity
            where ${pid} = any(pg_blocking_pids(pid))
          `);
          if (waiting.rows.length) break;
          assert.ok(Date.now() < deadline, "service must wait for the workspace ledger lock");
          await delay(10);
        }
        await winner(tx);
      });
      return await outcome;
    } finally {
      // Even a failed assertion must release the blocker and drain the writer
      // before fixture cleanup; otherwise tests could leak writes into the next case.
      if (outcome) await outcome;
    }
  }

  async function closeAccount(tx: LedgerTransaction, accountId: string) {
    await tx.update(schema.transactions).set({ status: "reconciled" })
      .where(eq(schema.transactions.accountId, accountId));
    await tx.update(schema.financialAccounts).set({
      reconciledAt: "2026-01-31", reconciledBalance: "100",
    }).where(eq(schema.financialAccounts.id, accountId));
  }

  for (const kind of ["create", "update", "delete", "import", "transfer-create", "transfer-delete", "settlement-delete"] as const) {
    it(`rechecks reconciliation after a blocked ${kind}`, async () => {
      const { userId, workspaceId, account } = await fixture();
      try {
        const row = await money.create(workspaceId, {
          accountId: account.id, amount: 10, date: "2026-01-10", type: "expense", category: "Food",
        });
        let operation: () => Promise<unknown>;
        if (kind === "create") {
          operation = () => money.create(workspaceId, {
            accountId: account.id, amount: 10, date: "2026-01-10", type: "income", category: "Pay",
          });
        } else if (kind === "update") {
          operation = () => money.update(workspaceId, row.id, { accountId: null, amount: 20 });
        } else if (kind === "delete") {
          operation = () => money.remove(workspaceId, row.id);
        } else if (kind === "import") {
          operation = () => money.importRows(workspaceId, account.id, [{
            lineNumber: 1, amount: 10, date: "2026-01-10", type: "expense", category: "Food",
            payee: null, notes: null, tags: [], externalId: "race-import",
          }]);
        } else if (kind === "settlement-delete") {
          const service = recurring.createRecurringMoneyOccurrences(recurring.fixedClock("2026-01-10"));
          const schedule = await schedules.create(workspaceId, {
            name: "Rent", amount: 10, type: "expense", dayOfMonth: 10, category: "Housing",
          });
          const occurrenceId = recurring.recurringMoneyOccurrenceId(schedule.id, "2026-01-01");
          const settlement = await service.settle(workspaceId, {
            action: "mark-paid", occurrenceId, paidAt: "2026-01-10",
          });
          await money.update(workspaceId, settlement.transactionId, { accountId: account.id });
          operation = () => service.settle(workspaceId, {
            action: "unmatch", occurrenceId, transactionId: settlement.transactionId,
          });
        } else {
          const other = await accounts.create(workspaceId, {
            name: "Other", accountClass: "asset", accountType: "cash", currency: "GBP",
            openingBalance: 0, openingDate: "2026-01-01",
          });
          const input = { fromAccountId: account.id, toAccountId: other.id, amount: 10, date: "2026-01-10" };
          if (kind === "transfer-create") operation = () => accounts.createTransfer(workspaceId, input);
          else {
            const transfer = await accounts.createTransfer(workspaceId, input);
            operation = () => accounts.removeTransfer(workspaceId, transfer.id);
          }
        }
        const result = await race(workspaceId, operation, (tx) => closeAccount(tx, account.id));
        assert.ok("error" in result);
        assert.match(String(result.error), /locked by reconciliation|Reconciled transactions? /);
        assert.equal((await money.getById(workspaceId, row.id))?.amount, "10.00");
      } finally {
        await db.delete(schema.users).where(eq(schema.users.id, userId));
      }
    });
  }

  it("recalculates the balance after an earlier ledger writer commits", async () => {
    const { userId, workspaceId, account } = await fixture();
    try {
      const result = await race(workspaceId, () => accounts.reconcile(workspaceId, account.id, {
        statementDate: "2026-01-31", statementBalance: 100,
      }), async (tx) => {
        await tx.insert(schema.transactions).values({
          id: crypto.randomUUID(), userId, workspaceId, accountId: account.id,
          amount: "25", date: "2026-01-10", type: "expense", category: "Food",
        });
      });
      assert.deepEqual(result, { value: { reconciled: false, calculatedBalance: 75, difference: 25 } });
      assert.equal((await accounts.getById(workspaceId, account.id)).reconciledAt, null);
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
  });

  for (const action of ["update", "delete"] as const) {
    it(`reloads a pending row's changed account and date before ${action}`, async () => {
      const { userId, workspaceId, account } = await fixture();
      try {
        const row = await money.create(workspaceId, {
          amount: 10, date: "2026-02-10", type: "expense", category: "Food", status: "pending",
        });
        const result = await race<unknown>(workspaceId,
          () => action === "update"
            ? money.update(workspaceId, row.id, { status: "cleared" })
            : money.remove(workspaceId, row.id),
          async (tx) => {
            await tx.update(schema.transactions).set({ accountId: account.id, date: "2026-01-10" })
              .where(eq(schema.transactions.id, row.id));
            // Reconciliation excludes pending rows, but closes their dates too.
            await tx.update(schema.financialAccounts).set({
              reconciledAt: "2026-01-31", reconciledBalance: "100",
            }).where(eq(schema.financialAccounts.id, account.id));
          });
        assert.ok("error" in result);
        assert.match(String(result.error), /locked by reconciliation/);
        assert.equal((await money.getById(workspaceId, row.id))?.status, "pending");
      } finally {
        await db.delete(schema.users).where(eq(schema.users.id, userId));
      }
    });
  }

  it("rejects forged status on accountless rows and preserves reconciled metadata edits", async () => {
    const { userId, workspaceId, account } = await fixture();
    try {
      const row = await money.create(workspaceId, {
        amount: 10, date: "2026-01-10", type: "expense", category: "Food",
      });
      await assert.rejects(money.update(workspaceId, row.id, { status: "reconciled" }),
        /only be reconciled through account reconciliation/);
      assert.equal((await money.getById(workspaceId, row.id))?.status, "cleared");
      await money.update(workspaceId, row.id, { accountId: account.id });
      await accounts.reconcile(workspaceId, account.id, {
        statementDate: "2026-01-31", statementBalance: 90,
      });
      assert.equal((await money.update(workspaceId, row.id, { notes: "Reviewed" })).status, "reconciled");
      const next = await money.create(workspaceId, {
        accountId: account.id, amount: 10, date: "2026-02-01", type: "income", category: "Pay",
      });
      assert.equal(next.status, "cleared");
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
  });

  it("does not let an older concurrent reconciliation move the boundary backwards", async () => {
    const { userId, workspaceId, account } = await fixture();
    try {
      const result = await race(workspaceId, () => accounts.reconcile(workspaceId, account.id, {
        statementDate: "2026-01-15", statementBalance: 100,
      }), (tx) => closeAccount(tx, account.id));
      assert.ok("error" in result);
      assert.match(String(result.error), /Statement date must be after 2026-01-31/);
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
  });
});
