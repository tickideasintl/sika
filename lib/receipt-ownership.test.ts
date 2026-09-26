import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/db/client";
import { storedObjects, transactionDocuments, transactions, workspaces } from "@/db/schema";
import { assertStoredObjectInWorkspace, StoredObjectOwnershipError } from "./db/stored-objects";
import * as transactionService from "./db/transactions";
import * as documentsService from "./db/transaction-documents";
import { createWorkspaceArchiveSource } from "./db/workspace-export";
import { buildWorkspaceArchive } from "./workspace-archive";
import { deleteStoredDocument, getStoredDocument, uploadReceipt, uploadSupportingDocument } from "./storage";

// All database and S3 boundaries are replaced. These tests never use a live DB,
// even when DATABASE_URL is present in the invoking environment.
const workspaceId = "workspace-a";
const foreignWorkspace = "workspace-b";
const ownKey = "receipts/owned.jpg";
const foreignKey = "receipts/foreign.jpg";
const dialect = new PgDialect();
type Row = Record<string, unknown>;
let ownership: Map<string, string>;
let transactionRows: Row[];
let documentRows: Row[];
let writes: Row[];
let commands: unknown[];
let lockedKeys: string[];

function query(selection?: Record<string, unknown>) {
  let table: unknown;
  let params: unknown[] = [];
  const chain = {
    from(value: unknown) { table = value; return chain; },
    where(condition: SQL) { params = dialect.sqlToQuery(condition).params; return chain; },
    innerJoin() { return chain; },
    limit() { return chain; },
    for(mode: string) {
      assert.equal(mode, "update");
      if (table === storedObjects) lockedKeys.push(String(params[0]));
      return chain;
    },
    then(resolve: (rows: Row[]) => unknown, reject: (error: unknown) => unknown) {
      return Promise.resolve().then(() => {
        let rows: Row[] = [];
        if (table === storedObjects) {
          // Fail tests if the ownership predicate ever stops binding the workspace.
          assert.ok(params.includes(workspaceId) || params.includes(foreignWorkspace));
          rows = [...ownership].filter(([key, owner]) =>
            params.includes(owner) && (params.length === 1 || params.includes(key)),
          ).map(([storageKey, owner]) => ({ storageKey, workspaceId: owner }));
        } else if (table === workspaces) {
          rows = [{ id: workspaceId, userId: "owner", name: "Test" }];
        } else if (table === transactions) {
          rows = transactionRows;
          if (params.some((param) => typeof param === "string" && /^(receipts|supporting-documents)\//.test(param))) {
            rows = rows.filter((row) => params.includes(row.receiptStorageId));
          }
          if (selection?.storageKey) {
            rows = rows.filter((row) => row.receiptStorageId != null).map((row) => ({
              transactionId: row.id, storageKey: row.receiptStorageId,
            }));
          }
        } else if (table === transactionDocuments) {
          rows = documentRows;
          if (params.some((param) => typeof param === "string" && /^(receipts|supporting-documents)\//.test(param))) {
            rows = rows.filter((row) => params.includes(row.storageKey));
          }
        }
        return rows;
      }).then(resolve, reject);
    },
  };
  return chain;
}

describe("receipt workspace ownership (isolated database and S3 mocks)", () => {
  beforeEach(() => {
    ownership = new Map([[ownKey, workspaceId], [foreignKey, foreignWorkspace]]);
    transactionRows = [];
    documentRows = [];
    writes = [];
    commands = [];
    lockedKeys = [];
    // Defense against an accidentally unmocked code path making a real query.
    mock.method(db.$client, "query", () => { throw new Error("Live database access forbidden"); });
    mock.method(db.$client, "connect", () => { throw new Error("Live database access forbidden"); });
    mock.method(db, "select", query as unknown as typeof db.select);
    mock.method(db, "transaction", (async (callback: (tx: typeof db) => unknown) =>
      callback(db)) as unknown as typeof db.transaction);
    mock.method(db, "insert", ((table: unknown) => ({
      values(row: Row) {
        writes.push(row);
        if (table === storedObjects) ownership.set(String(row.storageKey), String(row.workspaceId));
        return { returning: async () => [row] };
      },
    })) as unknown as typeof db.insert);
    mock.method(db, "update", (() => ({
      set(row: Row) {
        writes.push(row);
        return { where: () => ({ returning: async () => [row] }) };
      },
    })) as unknown as typeof db.update);
    mock.method(db, "delete", ((table: unknown) => ({
      async where(condition: SQL) {
        assert.equal(table, storedObjects);
        const params = dialect.sqlToQuery(condition).params;
        assert.ok(params.includes(workspaceId));
        ownership.delete(String(params[0]));
      },
    })) as unknown as typeof db.delete);
    mock.method(S3Client.prototype, "send", (async (command: unknown) => {
      commands.push(command);
      return {
        Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
        ContentType: "image/jpeg",
      };
    }) as unknown as typeof S3Client.prototype.send);
    // Dummy values only; send is mocked before a client can be used.
    for (const [key, value] of Object.entries({
      S3_ENDPOINT: "https://storage.invalid", S3_BUCKET: "test",
      S3_ACCESS_KEY_ID: "test", S3_SECRET_ACCESS_KEY: "test",
    })) {
      const original = process.env[key];
      process.env[key] = value;
      environmentCleanup.push(() => {
        if (original === undefined) delete process.env[key];
        else process.env[key] = original;
      });
    }
  });

  const environmentCleanup: Array<() => void> = [];
  afterEach(() => {
    mock.restoreAll();
    environmentCleanup.splice(0).forEach((cleanup) => cleanup());
  });

  it("rejects foreign, unknown legacy, URL, and malformed keys", async () => {
    for (const key of [foreignKey, "receipts/legacy.jpg", "https://public.test/" + ownKey, "", "../secret"]) {
      await assert.rejects(assertStoredObjectInWorkspace(workspaceId, key), StoredObjectOwnershipError);
    }
    await assertStoredObjectInWorkspace(workspaceId, ownKey);
    await assertStoredObjectInWorkspace(workspaceId, null);
    await assertStoredObjectInWorkspace(workspaceId, undefined);
  });

  it("rejects foreign receipts on both transaction write paths before mutation", async () => {
    await assert.rejects(transactionService.create(workspaceId, {
      amount: 1, date: "2026-08-01", type: "expense", category: "Test", receiptStorageId: foreignKey,
    }), StoredObjectOwnershipError);
    await assert.rejects(transactionService.update(workspaceId, "tx", {
      receiptStorageId: foreignKey,
    }), StoredObjectOwnershipError);
    await assert.rejects(documentsService.create(workspaceId, "tx", {
      storageKey: foreignKey, fileName: "Receipt", mimeType: "image/jpeg", sizeBytes: 1,
    }), StoredObjectOwnershipError);
    assert.equal(writes.length, 0);
  });

  it("allows same-workspace receipts on both transaction write paths and explicit removal", async () => {
    const row = await transactionService.create(workspaceId, {
      amount: 1, date: "2026-08-01", type: "expense", category: "Test", receiptStorageId: ownKey,
    });
    assert.equal(row.receiptStorageId, ownKey);
    transactionRows = [row];
    const updated = await transactionService.update(workspaceId, String(row.id), { receiptStorageId: ownKey });
    assert.equal(updated.receiptStorageId, ownKey);
    const removed = await transactionService.update(workspaceId, String(row.id), { receiptStorageId: null });
    assert.equal(removed.receiptStorageId, null);
  });

  it("does not grandfather a previously planted reference on update", async () => {
    transactionRows = [{ id: "tx", workspaceId, type: "expense", receiptStorageId: foreignKey }];
    await assert.rejects(transactionService.update(workspaceId, "tx", {
      receiptStorageId: foreignKey,
    }), StoredObjectOwnershipError);
    // An unrelated edit does not claim or authorize the historical key.
    await transactionService.update(workspaceId, "tx", { notes: "Corrected" });
    assert.equal(ownership.get(foreignKey), foreignWorkspace);
  });

  it("blocks foreign and unverified storage reads and deletions before S3", async () => {
    for (const key of [foreignKey, "receipts/old.jpg"]) {
      await assert.rejects(getStoredDocument(workspaceId, key), StoredObjectOwnershipError);
      await assert.rejects(deleteStoredDocument(workspaceId, key), StoredObjectOwnershipError);
    }
    assert.equal(commands.length, 0);
    await getStoredDocument(workspaceId, ownKey);
    await deleteStoredDocument(workspaceId, ownKey);
    assert.ok(commands[0] instanceof GetObjectCommand);
    assert.ok(commands[1] instanceof DeleteObjectCommand);
  });

  it("records immutable workspace provenance for receipt and supporting-document uploads", async () => {
    for (const upload of [uploadReceipt, uploadSupportingDocument]) {
      const result = await upload(Buffer.from([1]), "image/jpeg", workspaceId);
      assert.equal(ownership.get(result.key), workspaceId);
      await assert.rejects(assertStoredObjectInWorkspace(foreignWorkspace, result.key), StoredObjectOwnershipError);
    }
    assert.equal(commands.length, 2);
    assert.ok(commands.every((command) => command instanceof PutObjectCommand));
  });

  it("keeps a shared object until the final document reference is removed", async () => {
    documentRows = [{ id: "remaining-document", workspaceId, storageKey: ownKey }];
    await deleteStoredDocument(workspaceId, ownKey);
    assert.equal(commands.length, 0);
    assert.equal(ownership.get(ownKey), workspaceId);
    documentRows = [];
    await deleteStoredDocument(workspaceId, ownKey);
    assert.equal(commands.length, 1);
    assert.ok(commands[0] instanceof DeleteObjectCommand);
    assert.equal(ownership.has(ownKey), false);
    await assert.rejects(assertStoredObjectInWorkspace(workspaceId, ownKey), StoredObjectOwnershipError);
  });

  it("preserves objects still referenced by another transaction receipt", async () => {
    transactionRows = [{ id: "other-transaction", workspaceId, receiptStorageId: ownKey }];
    await deleteStoredDocument(workspaceId, ownKey);
    assert.equal(commands.length, 0);
    assert.equal(ownership.get(ownKey), workspaceId);
    // A different key must not block cleanup.
    transactionRows[0].receiptStorageId = foreignKey;
    await deleteStoredDocument(workspaceId, ownKey);
    assert.equal(commands.length, 1);
  });

  it("checks both reference types even for historically planted cross-workspace references", async () => {
    documentRows = [{ id: "legacy", workspaceId: foreignWorkspace, storageKey: ownKey }];
    await deleteStoredDocument(workspaceId, ownKey);
    assert.equal(commands.length, 0);
    assert.equal(ownership.get(ownKey), workspaceId);
  });

  it("retires authorization before S3 and fails closed when S3 deletion fails", async () => {
    mock.method(S3Client.prototype, "send", (async () => {
      assert.equal(ownership.has(ownKey), false);
      throw new Error("Storage unavailable");
    }) as unknown as typeof S3Client.prototype.send);
    await assert.rejects(deleteStoredDocument(workspaceId, ownKey), /Storage unavailable/);
    await assert.rejects(transactionService.create(workspaceId, {
      amount: 1, date: "2026-08-01", type: "expense", category: "Test", receiptStorageId: ownKey,
    }), StoredObjectOwnershipError);
    assert.equal(writes.length, 0);
  });

  it("rechecks authorization under the same row lock before all reference writes", async () => {
    const row = await transactionService.create(workspaceId, {
      amount: 1, date: "2026-08-01", type: "giving", category: "Test", receiptStorageId: ownKey,
    });
    transactionRows = [row];
    await transactionService.update(workspaceId, String(row.id), { receiptStorageId: ownKey });
    await documentsService.create(workspaceId, String(row.id), {
      storageKey: ownKey, fileName: "Receipt", mimeType: "image/jpeg", sizeBytes: 1,
    });
    await deleteStoredDocument(workspaceId, ownKey);
    assert.deepEqual(lockedKeys, [ownKey, ownKey, ownKey, ownKey]);
  });

  it("rejects a key retired between preliminary validation and the reference write", async () => {
    transactionRows = [{ id: "tx", workspaceId, type: "giving", receiptStorageId: null }];
    mock.method(db, "transaction", (async (callback: (tx: typeof db) => unknown) => {
      ownership.delete(ownKey);
      return callback(db);
    }) as unknown as typeof db.transaction);
    const attempts = [
      () => transactionService.create(workspaceId, {
        amount: 1, date: "2026-08-01", type: "giving", category: "Test", receiptStorageId: ownKey,
      }),
      () => transactionService.update(workspaceId, "tx", { receiptStorageId: ownKey }),
      () => documentsService.create(workspaceId, "tx", {
        storageKey: ownKey, fileName: "Receipt", mimeType: "image/jpeg", sizeBytes: 1,
      }),
    ];
    for (const attempt of attempts) {
      ownership.set(ownKey, workspaceId);
      await assert.rejects(attempt(), StoredObjectOwnershipError);
    }
    assert.equal(writes.length, 0);
  });

  it("never returns an upload if provenance persistence fails", async () => {
    mock.method(db, "insert", () => { throw new Error("Database unavailable"); });
    await assert.rejects(uploadReceipt(Buffer.from([1]), "image/jpeg", workspaceId), /Database unavailable/);
    assert.ok(commands[0] instanceof PutObjectCommand);
    assert.ok(commands[1] instanceof DeleteObjectCommand);
    assert.equal(
      (commands[0] as PutObjectCommand).input.Key,
      (commands[1] as DeleteObjectCommand).input.Key,
    );
  });

  it("rejects planted legacy transaction and migrated supporting-document references in archive sources", async () => {
    transactionRows = [{ id: "tx", workspaceId, receiptStorageId: foreignKey }];
    await assert.rejects(createWorkspaceArchiveSource(workspaceId), StoredObjectOwnershipError);
    transactionRows = [];
    documentRows = [{
      documentId: "legacy-tx", transactionId: "tx", storageKey: foreignKey, fileName: "Receipt",
    }];
    await assert.rejects(createWorkspaceArchiveSource(workspaceId), StoredObjectOwnershipError);
    documentRows[0].storageKey = "receipts/unverified.jpg";
    await assert.rejects(createWorkspaceArchiveSource(workspaceId), StoredObjectOwnershipError);
  });

  it("archives a same-workspace receipt, then rechecks ownership at the S3 read boundary", async () => {
    transactionRows = [{ id: "tx", workspaceId, receiptStorageId: ownKey }];
    const source = await createWorkspaceArchiveSource(workspaceId);
    assert.equal(source.files.length, 1);
    const bytes = await buildWorkspaceArchive(source.workspaceExport, source.files, getStoredDocument);
    assert.ok(bytes.length > 0);
    assert.equal(commands.length, 1);
    ownership.delete(ownKey);
    await assert.rejects(
      buildWorkspaceArchive(source.workspaceExport, source.files, getStoredDocument),
      /could not be read/,
    );
    assert.equal(commands.length, 1);
  });
});
