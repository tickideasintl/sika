import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { db } from "@/db/client";
import {
  clients,
  givingDesignations,
  givingRecipients,
  recurringMoneyOccurrences,
  recurringOutgoings,
} from "@/db/schema";
import * as schedules from "./recurring-outgoings";

describe("recurring schedule transaction reads", () => {
  let row: Record<string, unknown>;
  let history: boolean;
  let selected: unknown[];
  let deleted: boolean;

  beforeEach(() => {
    row = {
      id: "schedule", workspaceId: "workspace", type: "expense",
      clientId: "client", givingRecipientId: null, givingDesignationId: null,
      rebillMode: "none", rebillAmount: null,
    };
    history = false;
    selected = [];
    deleted = false;
    mock.method(db.$client, "query", () => { throw new Error("Live database access forbidden"); });
    mock.method(db.$client, "connect", () => { throw new Error("Live database access forbidden"); });
    mock.method(db, "select", () => { throw new Error("Nested pool read while transaction holds schedule lock"); });
    const tx = {
      select() {
        let table: unknown;
        const query = {
          from(value: unknown) { table = value; selected.push(value); return query; },
          where() { return query; },
          limit() { return query; },
          for(mode: string) { assert.equal(mode, "update"); return query; },
          then(resolve: (rows: unknown[]) => unknown) {
            return Promise.resolve(table === recurringOutgoings ? [row]
              : table === recurringMoneyOccurrences ? (history ? [{ id: "occurrence" }] : [])
                : [{ id: "attribution" }]).then(resolve);
          },
        };
        return query;
      },
      update() {
        return {
          set(values: Record<string, unknown>) {
            return { where: () => ({ returning: async () => [{ ...row, ...values }] }) };
          },
        };
      },
      delete() {
        return { where: async () => { deleted = true; } };
      },
    };
    mock.method(db, "transaction", (async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx)) as unknown as typeof db.transaction);
  });

  afterEach(() => mock.restoreAll());

  it("validates the existing client on the same transaction as an expense edit", async () => {
    const updated = await schedules.update("workspace", "schedule", { notes: "Updated" });
    assert.equal(updated.notes, "Updated");
    assert.deepEqual(selected, [recurringOutgoings, clients]);
  });

  it("validates recipient and designation on the same transaction as a giving edit", async () => {
    row = { ...row, type: "giving", clientId: null, givingRecipientId: "recipient", givingDesignationId: "fund" };
    await schedules.update("workspace", "schedule", { notes: "Updated" });
    assert.deepEqual(selected, [recurringOutgoings, givingRecipients, givingDesignations]);
  });

  it("checks occurrence history inside the deletion transaction", async () => {
    await schedules.remove("workspace", "schedule");
    assert.deepEqual(selected, [recurringOutgoings, recurringMoneyOccurrences]);
    assert.equal(deleted, true);
  });

  it("still prevents deletion of schedules with recorded history", async () => {
    history = true;
    await assert.rejects(schedules.remove("workspace", "schedule"), /Deactivate Recurring money/);
    assert.equal(deleted, false);
  });
});
