import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { assertStoredObjectInWorkspace, registerStoredObject } from "@/lib/db/stored-objects";

// ---------------------------------------------------------------------------
// S3-compatible storage helper
// ---------------------------------------------------------------------------

/** Lazily-initialised singleton – avoids recreating the client per request. */
let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3Client) return _s3Client;

  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing S3 configuration – set S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    );
  }

  _s3Client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // required for most S3-compatible providers (MinIO, R2, etc.)
  });

  return _s3Client;
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("Missing S3_BUCKET environment variable.");
  }
  return bucket;
}

/** Map common image MIME types to file extensions. */
function extForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
  };
  return map[mime] ?? "";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UploadResult {
  /** Unique object key in the bucket (acts as storageId). */
  key: string;
  /**
   * Stable URL for the object.
   *
   * - If `S3_PUBLIC_URL` is set (e.g. a CDN or public bucket base URL), the
   *   URL is built from that: `<S3_PUBLIC_URL>/<key>`.
   * - Otherwise, the key itself is returned so that callers never receive a
   *   potentially private/internal endpoint URL.
   */
  url: string;
}

/**
 * Upload a buffer to S3-compatible storage and return the object key + URL.
 */
export async function uploadReceipt(
  buffer: Buffer,
  mimeType: string,
  workspaceId: string,
): Promise<UploadResult> {
  const client = getS3Client();
  const bucket = getBucket();

  const key = `receipts/${randomUUID()}${extForMime(mimeType)}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  await recordUploadOwnership(workspaceId, key);

  // Build a public URL only when an explicit public base URL is configured.
  // This avoids leaking internal S3 endpoint addresses to the client.
  const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
  const url = publicBase ? `${publicBase}/${key}` : key;

  return { key, url };
}

export function isStorageConfigured() {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET,
  );
}

export async function uploadSupportingDocument(
  buffer: Buffer,
  mimeType: string,
  workspaceId: string,
): Promise<UploadResult> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = `supporting-documents/${randomUUID()}${extForMime(mimeType)}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  await recordUploadOwnership(workspaceId, key);
  const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
  return { key, url: publicBase ? `${publicBase}/${key}` : key };
}

export async function getStoredDocument(workspaceId: string, key: string) {
  await assertStoredObjectInWorkspace(workspaceId, key);
  const result = await getS3Client().send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
  );
  if (!result.Body) throw new Error("Stored document is empty");
  return {
    bytes: await result.Body.transformToByteArray(),
    contentType: result.ContentType,
  };
}

export async function deleteStoredDocument(workspaceId: string, key: string) {
  await assertStoredObjectInWorkspace(workspaceId, key);
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
}

async function recordUploadOwnership(workspaceId: string, key: string) {
  try {
    await registerStoredObject(workspaceId, key);
  } catch (error) {
    // This key was generated in this request, not supplied by a caller.
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
    ).catch(() => undefined);
    throw error;
  }
}
