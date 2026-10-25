import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptApiKey, encryptApiKey, isCurrentApiKeyEncryption } from "./ai-key-encryption";

const secret = "test-secret-test-secret-test-secret-1234";

describe("AI provider key encryption", () => {
  it("round-trips without exposing the key", () => {
    const stored = encryptApiKey("sk-live-123", "user-a", secret);
    assert.ok(stored.startsWith("v1:"));
    assert.ok(!stored.includes("sk-live-123"));
    assert.ok(!stored.includes(Buffer.from("sk-live-123").toString("base64")));
    assert.notEqual(encryptApiKey("sk-live-123", "user-a", secret), stored);
    assert.equal(decryptApiKey(stored, "user-a", secret), "sk-live-123");
    assert.equal(isCurrentApiKeyEncryption(stored), true);
  });

  it("fails closed for another user, another secret or tampering", () => {
    const stored = encryptApiKey("sk-live-123", "user-a", secret);
    assert.equal(decryptApiKey(stored, "user-b", secret), null);
    assert.equal(decryptApiKey(stored, "user-a", `${secret}-rotated`), null);
    const tampered = `${stored.slice(0, -2)}${stored.endsWith("A") ? "B" : "A"}A`;
    assert.equal(decryptApiKey(tampered, "user-a", secret), null);
  });

  it("still reads legacy base64 and plain values", () => {
    const legacy = `enc:${Buffer.from("sk-old").toString("base64")}`;
    assert.equal(decryptApiKey(legacy, "user-a", secret), "sk-old");
    assert.equal(decryptApiKey("sk-plain", "user-a", secret), "sk-plain");
    assert.equal(isCurrentApiKeyEncryption(legacy), false);
    assert.equal(decryptApiKey(null, "user-a", secret), null);
  });

  it("refuses to encrypt without a secret", () => {
    assert.throws(() => encryptApiKey("sk", "user-a", ""), /BETTER_AUTH_SECRET/);
  });
});
