import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const CURRENT_PREFIX = "v1:";
const LEGACY_BASE64_PREFIX = "enc:";
const KEY_INFO = "sika:ai-provider-api-key:v1";

function deriveKey(secret: string | undefined): Buffer {
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required to store AI provider API keys");
  }
  return Buffer.from(hkdfSync("sha256", secret, "", KEY_INFO, 32));
}

/** AES-256-GCM, keyed from BETTER_AUTH_SECRET and bound to the owning user. */
export function encryptApiKey(
  plaintext: string,
  userId: string,
  secret: string | undefined = process.env.BETTER_AUTH_SECRET,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${CURRENT_PREFIX}${[iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".")}`;
}

/** Decrypts current values and reads legacy base64/plain values; returns null when unreadable. */
export function decryptApiKey(
  stored: string | null,
  userId: string,
  secret: string | undefined = process.env.BETTER_AUTH_SECRET,
): string | null {
  if (!stored) return null;
  if (stored.startsWith(LEGACY_BASE64_PREFIX)) {
    return Buffer.from(stored.slice(LEGACY_BASE64_PREFIX.length), "base64").toString("utf8");
  }
  if (!stored.startsWith(CURRENT_PREFIX)) return stored;

  try {
    const [iv, tag, ciphertext] = stored
      .slice(CURRENT_PREFIX.length)
      .split(".")
      .map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
    decipher.setAAD(Buffer.from(userId, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function isCurrentApiKeyEncryption(stored: string | null): boolean {
  return !stored || stored.startsWith(CURRENT_PREFIX);
}
