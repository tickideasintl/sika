import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import {
  AiEndpointError,
  createGuardedLookup,
  getAiEndpointError,
  isPublicAddress,
  mayUseOperatorKey,
  postToAiEndpoint,
} from "./ai-endpoint";

describe("AI endpoint policy", () => {
  it("classifies internal and public addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.5",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "::",
      "::7f00:1",
      "::a00:1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "64:ff9b::a00:1",
      "not-an-ip",
    ]) {
      assert.equal(isPublicAddress(address), false, address);
    }
    for (const address of ["8.8.8.8", "104.18.6.192", "2606:4700::6810:84e5"]) {
      assert.equal(isPublicAddress(address), true, address);
    }
  });

  it("requires https and a public host unless private endpoints are allowed", () => {
    assert.equal(getAiEndpointError("https://api.openai.com/v1", false), null);
    assert.equal(getAiEndpointError("https://openrouter.ai/api/v1", false), null);
    assert.match(getAiEndpointError("http://api.example.com/v1", false) ?? "", /https/);
    assert.match(getAiEndpointError("https://127.0.0.1:9999/v1", false) ?? "", /private-network/);
    assert.match(getAiEndpointError("https://[::1]/v1", false) ?? "", /private-network/);
    assert.match(getAiEndpointError("https://169.254.169.254/v1", false) ?? "", /private-network/);
    assert.match(getAiEndpointError("https://localhost/v1", false) ?? "", /private-network/);
    assert.match(getAiEndpointError("https://user:pw@api.example.com/v1", false) ?? "", /credentials/);
    assert.match(getAiEndpointError("not a url", false) ?? "", /valid URL/);
    assert.match(getAiEndpointError("file:///etc/passwd", true) ?? "", /https/);
    assert.equal(getAiEndpointError("http://localhost:11434/v1", true), null);
  });

  it("only lets the operator key go to OpenAI", () => {
    assert.equal(mayUseOperatorKey("https://api.openai.com/v1"), true);
    assert.equal(mayUseOperatorKey("https://api.openai.com.evil.example/v1"), false);
    assert.equal(mayUseOperatorKey("http://api.openai.com/v1"), false);
    assert.equal(mayUseOperatorKey("https://openrouter.ai/api/v1"), false);
    assert.equal(mayUseOperatorKey("http://127.0.0.1:9999/v1"), false);
  });

  it("refuses hostnames that resolve to internal addresses at connect time", async () => {
    const lookup = createGuardedLookup(false);
    const error = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      lookup("localhost", { all: true }, (err) => resolve(err));
    });
    assert.ok(error instanceof AiEndpointError);
  });

  it("never connects to a private listener unless allowed", async () => {
    const seen: string[] = [];
    const server = http.createServer((request, response) => {
      seen.push(request.headers.authorization ?? "");
      response.setHeader("Content-Type", "application/json");
      response.end('{"ok":true}');
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await assert.rejects(
        postToAiEndpoint(`http://127.0.0.1:${port}/v1/chat/completions`, { Authorization: "Bearer canary" }, "{}", {
          allowPrivate: false,
        }),
        AiEndpointError,
      );
      assert.deepEqual(seen, []);

      const allowed = await postToAiEndpoint(
        `http://localhost:${port}/v1/chat/completions`,
        { Authorization: "Bearer canary" },
        "{}",
        { allowPrivate: true },
      );
      assert.equal(allowed.status, 200);
      assert.equal(allowed.body, '{"ok":true}');

      await assert.rejects(
        postToAiEndpoint(`http://localhost:${port}/v1`, {}, "{}", {
          allowPrivate: true,
          maxResponseBytes: 4,
        }),
        /too large/,
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("enforces an overall deadline even while bytes keep arriving", async () => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200);
      const timer = setInterval(() => response.write(" "), 20);
      response.on("close", () => clearInterval(timer));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const started = Date.now();
      await assert.rejects(
        postToAiEndpoint(`http://127.0.0.1:${port}/v1`, {}, "{}", {
          allowPrivate: true,
          timeoutMs: 200,
        }),
        /timed out/,
      );
      assert.ok(Date.now() - started < 2000);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
