import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aiProviderSettings, users } from "@/db/schema";
import * as aiSettings from "./ai-provider-settings";

describe(
  "AI provider settings regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("keeps the operator key away from custom endpoints and encrypts stored keys", async () => {
      const userId = crypto.randomUUID();
      const previousKey = process.env.OPENAI_API_KEY;
      const previousSecret = process.env.BETTER_AUTH_SECRET;
      process.env.OPENAI_API_KEY = "sk-operator-canary";
      process.env.BETTER_AUTH_SECRET ||= "regression-secret-regression-secret-123";
      await db.insert(users).values({
        id: userId,
        name: "AI settings user",
        email: `ai-${userId.slice(0, 8)}@example.com`,
      });

      try {
        assert.equal((await aiSettings.getActiveSettings(userId))?.apiKey, "sk-operator-canary");

        await assert.rejects(
          aiSettings.updateSettings(userId, { provider: "custom", apiEndpoint: "http://127.0.0.1:9999/v1" }),
          /https/,
        );
        await assert.rejects(
          aiSettings.updateSettings(userId, { provider: "custom", apiEndpoint: "https://10.0.0.5/v1" }),
          /private-network/,
        );

        await assert.rejects(aiSettings.updateSettings(userId, { provider: "ollama" }), /https/);

        await aiSettings.updateSettings(userId, {
          provider: "custom",
          apiEndpoint: "https://attacker.example/v1",
          apiKey: "",
        });
        assert.equal((await aiSettings.getActiveSettings(userId))?.apiKey, null);

        await aiSettings.updateSettings(userId, { apiKey: "sk-user-own" });
        const [row] = await db
          .select({ apiKey: aiProviderSettings.apiKey })
          .from(aiProviderSettings)
          .where(eq(aiProviderSettings.userId, userId));
        assert.ok(row.apiKey?.startsWith("v1:"));
        assert.ok(!row.apiKey?.includes(Buffer.from("sk-user-own").toString("base64")));
        assert.equal((await aiSettings.getActiveSettings(userId))?.apiKey, "sk-user-own");

        await db
          .update(aiProviderSettings)
          .set({ apiKey: `enc:${Buffer.from("sk-legacy").toString("base64")}` })
          .where(eq(aiProviderSettings.userId, userId));
        assert.equal((await aiSettings.getOrCreateSettings(userId)).apiKey, "sk-legacy");
        const [upgraded] = await db
          .select({ apiKey: aiProviderSettings.apiKey })
          .from(aiProviderSettings)
          .where(eq(aiProviderSettings.userId, userId));
        assert.ok(upgraded.apiKey?.startsWith("v1:"));
      } finally {
        await db.delete(aiProviderSettings).where(eq(aiProviderSettings.userId, userId));
        await db.delete(users).where(eq(users.id, userId));
        if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = previousKey;
        if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
        else process.env.BETTER_AUTH_SECRET = previousSecret;
      }
    });
  },
);
