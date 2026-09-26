import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { receiptUpdate } from "./receipt-update";

describe("transaction receipt edits", () => {
  it("does not resubmit an unchanged historical receipt during ordinary edits", () => {
    assert.deepEqual(receiptUpdate("receipts/old.jpg", { receipt_url: "receipts/old.jpg" }), {});
    assert.equal(
      JSON.stringify({ notes: "Updated", ...receiptUpdate("receipts/old.jpg", { receipt_url: "receipts/old.jpg" }) }),
      '{"notes":"Updated"}',
    );
  });

  it("sends explicit null when removing an existing receipt", () => {
    assert.deepEqual(
      JSON.parse(JSON.stringify(receiptUpdate(null, { receipt_url: "receipts/old.jpg" }))),
      { receiptStorageId: null },
    );
  });

  it("sends replacement keys for server-side ownership validation", () => {
    assert.deepEqual(receiptUpdate("receipts/new.jpg", { receipt_url: "receipts/old.jpg" }), {
      receiptStorageId: "receipts/new.jpg",
    });
    assert.deepEqual(receiptUpdate("receipts/new.jpg", { receipt_url: null }), {
      receiptStorageId: "receipts/new.jpg",
    });
  });

  it("omits absent receipts and preserves scanned receipts on new transactions", () => {
    assert.deepEqual(receiptUpdate(null), {});
    assert.deepEqual(receiptUpdate(null, { receipt_url: null }), {});
    assert.deepEqual(receiptUpdate("receipts/new.jpg"), { receiptStorageId: "receipts/new.jpg" });
  });

  it("wires edit payloads and an explicit removal control into the form", () => {
    const source = readFileSync(new URL("../components/dashboard/transaction-form.tsx", import.meta.url), "utf8");
    assert.match(source, /\.\.\.receiptUpdate\(receiptStorageId, transaction\)/);
    assert.match(source, /onClick=\{\(\) => setReceiptStorageId\(null\)\}/);
    assert.match(source, /Remove receipt/);
  });
});
