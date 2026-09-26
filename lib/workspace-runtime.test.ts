import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { readFileSync } from "node:fs";
import { apiFetch, apiFetchBlob } from "../hooks/use-api";
import { getStoredWorkspaceCurrency } from "./currency";
import { bindWorkspace, resolveWorkspace } from "./workspace-runtime";

const originalFetch = globalThis.fetch;
afterEach(() => {
  bindWorkspace(null);
  globalThis.fetch = originalFetch;
});

it("fails closed for JSON and blob calls until the provider resolves", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  await assert.rejects(apiFetch("/api/transactions"), /Workspace is not ready/);
  await assert.rejects(apiFetchBlob("/api/export"), /Workspace is not ready/);
  assert.equal(calls, 0);
});

it("standalone requests and currency follow this tab, never shared storage", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let storedId = "workspace-a";
  const storage = { getItem: () => storedId };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try {
    bindWorkspace({ id: "workspace-a", currency: "GBP" });
    storedId = "workspace-b"; // Another tab changes the shared preference.
    const targets: (string | null)[] = [];
    globalThis.fetch = async (_url, init) => {
      targets.push(new Headers(init?.headers).get("x-workspace-id"));
      return Response.json({});
    };
    await apiFetch("/api/transactions", {
      method: "POST", headers: { "x-workspace-id": "workspace-b" },
    });
    await apiFetchBlob("/api/export");
    assert.deepEqual(targets, ["workspace-a", "workspace-a"]);
    assert.equal(getStoredWorkspaceCurrency(), "GBP");
    bindWorkspace({ id: "workspace-b", currency: "USD" });
    await apiFetch("/api/transactions", { method: "POST" });
    assert.equal(targets[2], "workspace-b");
    assert.equal(getStoredWorkspaceCurrency(), "USD");
    bindWorkspace(null);
    await assert.rejects(apiFetch("/api/transactions"), /Workspace is not ready/);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

it("refresh keeps the selected workspace and clears missing/empty membership", () => {
  const workspaces = [
    { id: "a", is_default: true },
    { id: "b", is_default: false },
  ];
  assert.equal(resolveWorkspace(workspaces, "b")?.id, "b");
  assert.equal(resolveWorkspace(workspaces, "removed")?.id, "a");
  assert.equal(resolveWorkspace([], "b"), null);
});

it("scans multipart receipts and saves their keys in the same non-default workspace", async () => {
  bindWorkspace({ id: "business-workspace", currency: "GBP" });
  const upload = new FormData();
  upload.append("file", new Blob(["synthetic receipt"], { type: "image/jpeg" }), "receipt.jpg");
  const key = "receipts/business-owned.jpg";
  const targets: (string | null)[] = [];
  globalThis.fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    targets.push(headers.get("x-workspace-id"));
    assert.equal(init?.method, "POST");
    if (url === "/api/receipts/scan") {
      assert.equal(init.body, upload);
      // The browser must supply the multipart boundary, not a JSON content type.
      assert.equal(headers.has("content-type"), false);
      return Response.json({ storageId: key, receiptUrl: "https://cdn.example.test/receipt.jpg" });
    }
    assert.equal(url, "/api/transactions");
    assert.equal(JSON.parse(String(init?.body)).receiptStorageId, key);
    return Response.json({ id: "saved-transaction" });
  };
  const scan = await apiFetch<{ storageId: string }>("/api/receipts/scan", {
    method: "POST", body: upload,
  });
  await apiFetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiptStorageId: scan.storageId }),
  });
  assert.deepEqual(targets, ["business-workspace", "business-workspace"]);

  const scanner = readFileSync(new URL("../components/dashboard/receipt-scanner.tsx", import.meta.url), "utf8");
  assert.match(scanner, /apiFetch<ReceiptData>\("\/api\/receipts\/scan",/);
  assert.doesNotMatch(scanner, /\bfetch\("\/api\/receipts\/scan"/);
});

it("surfaces scan errors through the workspace-aware request helper", async () => {
  bindWorkspace({ id: "business-workspace", currency: "GBP" });
  globalThis.fetch = async () => Response.json({ error: "AI provider not configured" }, { status: 400 });
  await assert.rejects(
    apiFetch("/api/receipts/scan", { method: "POST", body: new FormData() }),
    /AI provider not configured/,
  );
});

it("provider gates children and keys their drafts, reading persistence only once", () => {
  const source = readFileSync(new URL("../contexts/workspace-context.tsx", import.meta.url), "utf8");
  assert.match(source, /selectedId\.current === undefined.*getStoredWorkspaceId\(\)/);
  assert.match(source, /resolveWorkspace\(ws, selectedId\.current/);
  assert.match(source, /activeWorkspace && readyScope === scope/);
  assert.match(source, /<Fragment key=\{activeWorkspace\.id\}>/);
  assert.match(source, /return \(\) => bindWorkspace\(null\)/);
});
