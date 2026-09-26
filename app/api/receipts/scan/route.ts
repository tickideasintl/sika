import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { uploadReceipt } from "@/lib/storage";
import { getActiveSettings } from "@/lib/db/ai-provider-settings";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// ---------------------------------------------------------------------------
// Magic-byte signatures for allowed image formats
// ---------------------------------------------------------------------------

/** Check the first bytes of a buffer to verify the actual image format. */
function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }

  // GIF: 47 49 46 38
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return "image/gif";
  }

  // WebP: RIFF....WEBP  (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

// ---------------------------------------------------------------------------
// AI Vision – receipt OCR (configurable provider)
// ---------------------------------------------------------------------------

async function extractReceiptData(
  base64Image: string,
  mimeType: string,
  userId: string,
): Promise<Record<string, unknown>> {
  const settings = await getActiveSettings(userId);

  if (!settings) {
    throw new Error(
      "AI provider not configured. Please configure your AI provider in Settings.",
    );
  }

  const { endpoint, apiKey, model } = settings;

  if (!apiKey) {
    throw new Error(
      "API key not configured. Please add your API key in Settings > AI Provider.",
    );
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter-specific headers
      ...(endpoint.includes("openrouter.ai") && {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Sika",
      }),
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this receipt image and extract the following information in JSON format:
{
  "amount": <total amount as a number>,
  "date": <date in YYYY-MM-DD format, if not visible use today's date>,
  "vendor": <merchant/vendor name>,
  "category": <suggested category from: Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Education, Travel, Personal Care, Other>,
  "items": [<list of items if visible>]
}

Only return valid JSON, no additional text.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("AI API error:", response.status, errorText);
    throw new Error(`Failed to call AI API: ${response.statusText}`);
  }

  const data = await response.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Failed to extract receipt data");
  }

  const jsonContent = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return JSON.parse(jsonContent) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse receipt data");
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const rateKey = `${request.headers.get("x-forwarded-for") ?? "local"}:receipts:scan`;
    const rateLimit = checkRateLimit(rateKey, { limit: 10, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many receipt scans. Please wait a minute and try again." },
        { status: 429 },
      );
    }

    // Auth check -----------------------------------------------------------
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace();

    // Parse & validate file ------------------------------------------------
    const formData = await request.formData();
    const file = formData.get("file");

    // Runtime guard: ensure the value is an actual File (not a string etc.)
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Accepted: JPG, PNG, WebP, GIF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Magic-byte verification – prevents MIME spoofing ---------------------
    const detectedMime = detectImageMime(buffer);
    if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
      return NextResponse.json(
        {
          error:
            "File content does not match an allowed image format (JPG, PNG, WebP, GIF).",
        },
        { status: 400 },
      );
    }

    // OCR extraction -------------------------------------------------------
    const base64Image = buffer.toString("base64");
    const receiptData = await extractReceiptData(
      base64Image,
      detectedMime,
      actorUserId,
    );

    // Upload to S3-compatible storage --------------------------------------
    const { key, url } = await uploadReceipt(buffer, detectedMime, workspaceId);

    // Return stable response shape -----------------------------------------
    return NextResponse.json({
      ...receiptData,
      storageId: key,
      receiptUrl: url,
    });
  } catch (error: unknown) {
    // Log full detail server-side; return generic message to client
    console.error("Receipt scanning error:", error);
    
    // Provide specific error messages for common issues
    const errorMessage = error instanceof Error ? error.message : "Failed to process receipt";
    
    if (errorMessage.includes("AI provider not configured")) {
      return NextResponse.json(
        { error: errorMessage, code: "AI_PROVIDER_NOT_CONFIGURED" },
        { status: 400 },
      );
    }
    
    if (errorMessage.includes("API key not configured")) {
      return NextResponse.json(
        { error: errorMessage, code: "API_KEY_MISSING" },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: "Failed to process receipt. Please try again." },
      { status: 500 },
    );
  }
}
