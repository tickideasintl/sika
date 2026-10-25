import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aiProviderSettings } from "@/db/schema";
import {
  userIdSchema,
  aiProviderSettingsSchema,
  aiProviderSettingsUpdateSchema,
} from "./validation";
import { z } from "zod";
import { getAiEndpointError, mayUseOperatorKey } from "@/lib/ai-endpoint";
import {
  decryptApiKey,
  encryptApiKey,
  isCurrentApiKeyEncryption,
} from "@/lib/ai-key-encryption";

export type AIProvider =
  | "openai"
  | "openrouter"
  | "groq"
  | "together"
  | "ollama"
  | "custom";

export interface AIProviderSettings {
  id: string;
  userId: string;
  provider: AIProvider;
  apiEndpoint: string;
  apiKey: string | null;
  model: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInput {
  provider: AIProvider;
  apiEndpoint: string;
  apiKey?: string;
  model: string;
  isEnabled?: boolean;
}

export interface UpdateInput {
  provider?: AIProvider;
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
  isEnabled?: boolean;
}

// Default configurations for popular providers
export const PROVIDER_DEFAULTS: Record<AIProvider, { endpoint: string; models: string[] }> = {
  openai: {
    endpoint: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
  },
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1",
    models: [
      "meta-llama/llama-3.2-11b-vision-instruct",
      "google/gemma-3-27b-it",
      "qwen/qwen2.5-vl-72b-instruct",
      "anthropic/claude-3-haiku",
    ],
  },
  groq: {
    endpoint: "https://api.groq.com/openai/v1",
    models: [
      "llama-3.2-11b-vision-preview",
      "llama-3.2-90b-vision-preview",
      "mixtral-8x7b-32768",
    ],
  },
  together: {
    endpoint: "https://api.together.xyz/v1",
    models: [
      "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
      "meta-llama/Llama-Vision-Free",
    ],
  },
  ollama: {
    endpoint: "http://localhost:11434/v1",
    models: ["llava", "llama3.2-vision"],
  },
  custom: {
    endpoint: "",
    models: [], // Empty array triggers free-text input for custom models
  },
};

// Kept out of ./validation: that module is bundled for the browser and this check needs node:net.
const allowedEndpointSchema = z.string().superRefine((value, ctx) => {
  const message = getAiEndpointError(value);
  if (message) ctx.addIssue({ code: "custom", message, path: ["apiEndpoint"] });
});

function genId() {
  return crypto.randomUUID();
}

async function upgradeLegacyApiKey(id: string, userId: string, apiKey: string) {
  try {
    await db
      .update(aiProviderSettings)
      .set({ apiKey: encryptApiKey(apiKey, userId) })
      .where(eq(aiProviderSettings.id, id));
  } catch (error) {
    console.error("Failed to re-encrypt legacy AI provider key:", error);
  }
}

export async function getOrCreateSettings(
  userId: string,
): Promise<AIProviderSettings> {
  userIdSchema.parse(userId);

  const existing = await db
    .select()
    .from(aiProviderSettings)
    .where(eq(aiProviderSettings.userId, userId))
    .limit(1);

  if (existing[0]) {
    const apiKey = decryptApiKey(existing[0].apiKey, userId);
    if (apiKey && !isCurrentApiKeyEncryption(existing[0].apiKey)) {
      await upgradeLegacyApiKey(existing[0].id, userId, apiKey);
    }
    return { ...existing[0], apiKey } as AIProviderSettings;
  }

  // Create default settings
  const defaults = PROVIDER_DEFAULTS.openai;
  const now = new Date();

  const [row] = await db
    .insert(aiProviderSettings)
    .values({
      id: genId(),
      userId,
      provider: "openai",
      apiEndpoint: defaults.endpoint,
      apiKey: null,
      model: defaults.models[0],
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    ...row,
    apiKey: null,
  } as AIProviderSettings;
}

export async function updateSettings(
  userId: string,
  input: UpdateInput,
): Promise<AIProviderSettings> {
  userIdSchema.parse(userId);
  const validInput = aiProviderSettingsUpdateSchema.parse(input);

  const [existing] = await db
    .select({ id: aiProviderSettings.id })
    .from(aiProviderSettings)
    .where(eq(aiProviderSettings.userId, userId))
    .limit(1);

  if (!existing) {
    // Create with defaults first, then update
    await getOrCreateSettings(userId);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (validInput.provider !== undefined) {
    updateData.provider = validInput.provider;
    // Auto-update endpoint if switching to a known provider
    if (validInput.provider !== "custom" && !validInput.apiEndpoint) {
      updateData.apiEndpoint = allowedEndpointSchema.parse(
        PROVIDER_DEFAULTS[validInput.provider].endpoint,
      );
    }
  }
  if (validInput.apiEndpoint !== undefined) {
    updateData.apiEndpoint = allowedEndpointSchema.parse(validInput.apiEndpoint);
  }
  if (validInput.apiKey !== undefined) {
    updateData.apiKey = validInput.apiKey
      ? encryptApiKey(validInput.apiKey, userId)
      : null;
  }
  if (validInput.model !== undefined) {
    updateData.model = validInput.model;
  }
  if (validInput.isEnabled !== undefined) {
    updateData.isEnabled = validInput.isEnabled;
  }

  const [row] = await db
    .update(aiProviderSettings)
    .set(updateData)
    .where(eq(aiProviderSettings.userId, userId))
    .returning();

  return {
    ...row,
    apiKey: decryptApiKey(row.apiKey, userId),
  } as AIProviderSettings;
}

export async function getActiveSettings(userId: string): Promise<{
  endpoint: string;
  apiKey: string | null;
  model: string;
} | null> {
  const settings = await getOrCreateSettings(userId);

  if (!settings.isEnabled) {
    return null;
  }

  const operatorKey = mayUseOperatorKey(settings.apiEndpoint)
    ? process.env.OPENAI_API_KEY
    : undefined;
  const apiKey = settings.apiKey || operatorKey || null;

  return {
    endpoint: settings.apiEndpoint,
    apiKey,
    model: settings.model,
  };
}
