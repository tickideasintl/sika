import { lookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

export const ALLOW_PRIVATE_AI_ENDPOINTS_ENV = "SIKA_ALLOW_PRIVATE_AI_ENDPOINTS";

const OPERATOR_KEY_ORIGIN = "https://api.openai.com";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const PRIVATE_ENDPOINT_MESSAGE = `Local and private-network AI endpoints are disabled on this server. The operator can allow them with ${ALLOW_PRIVATE_AI_ENDPOINTS_ENV}=true.`;

export class AiEndpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiEndpointError";
  }
}

const nonPublicRanges = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  nonPublicRanges.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  nonPublicRanges.addSubnet(network, prefix, "ipv6");
}

// Kept apart: BlockList matches IPv4 addresses against IPv4-mapped IPv6 rules.
const ipv4MappedRange = new BlockList();
ipv4MappedRange.addSubnet("::ffff:0:0", 96, "ipv6");

export function privateAiEndpointsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[ALLOW_PRIVATE_AI_ENDPOINTS_ENV] === "true";
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 6 && ipv4MappedRange.check(address, "ipv6")) return false;
  return !nonPublicRanges.check(address, family === 4 ? "ipv4" : "ipv6");
}

function bareHostname(url: URL): string {
  return url.hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
}

/** Returns a user-facing reason the endpoint is not allowed, or null when it is. */
export function getAiEndpointError(
  raw: string,
  allowPrivate = privateAiEndpointsAllowed(),
): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Must be a valid URL";
  }
  if (url.username || url.password) return "AI endpoint must not contain credentials";
  if (url.search || url.hash) return "AI endpoint must not contain a query string or fragment";
  if (url.protocol !== "https:" && !(allowPrivate && url.protocol === "http:")) {
    return "AI endpoint must use https://";
  }
  if (!allowPrivate) {
    const host = bareHostname(url);
    if (host === "localhost" || host.endsWith(".localhost")) return PRIVATE_ENDPOINT_MESSAGE;
    if (isIP(host) !== 0 && !isPublicAddress(host)) return PRIVATE_ENDPOINT_MESSAGE;
  }
  return null;
}

/** The operator's OPENAI_API_KEY may only ever be sent to OpenAI itself. */
export function mayUseOperatorKey(endpoint: string): boolean {
  try {
    return new URL(endpoint).origin === OPERATOR_KEY_ORIGIN;
  } catch {
    return false;
  }
}

/** DNS lookup that refuses non-public addresses at connect time, so a re-resolving hostname cannot slip past validation. */
export function createGuardedLookup(allowPrivate: boolean): LookupFunction {
  return (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
      if (error) {
        callback(error, "", 0);
        return;
      }
      if (!allowPrivate && addresses.some((entry) => !isPublicAddress(entry.address))) {
        callback(
          Object.assign(new AiEndpointError(PRIVATE_ENDPOINT_MESSAGE), { code: "EAI_BLOCKED" }),
          "",
          0,
        );
        return;
      }
      if (options.all) {
        (callback as unknown as (err: null, list: LookupAddress[]) => void)(null, addresses);
        return;
      }
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

export interface AiPostOptions {
  allowPrivate?: boolean;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface AiPostResponse {
  status: number;
  statusText: string;
  body: string;
}

/**
 * POSTs JSON to a user-configured AI endpoint. Redirects are not followed,
 * responses are not decompressed, and both duration and size are capped.
 */
export function postToAiEndpoint(
  url: string,
  headers: Record<string, string>,
  body: string,
  options: AiPostOptions = {},
): Promise<AiPostResponse> {
  const allowPrivate = options.allowPrivate ?? privateAiEndpointsAllowed();
  const endpointError = getAiEndpointError(url, allowPrivate);
  if (endpointError) return Promise.reject(new AiEndpointError(endpointError));

  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      target,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(body).toString(),
          "Accept-Encoding": "identity",
        },
        lookup: createGuardedLookup(allowPrivate),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let received = 0;
        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > maxResponseBytes) {
            response.destroy();
            reject(new AiEndpointError("AI provider response was too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (received > maxResponseBytes) return;
          resolve({
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? "",
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        response.on("error", reject);
      },
    );
    const deadline = setTimeout(() => {
      const error = new AiEndpointError("AI provider request timed out");
      reject(error);
      request.destroy(error);
    }, timeoutMs);
    request.on("close", () => clearTimeout(deadline));
    request.on("error", (error) => {
      const cause = (error as { cause?: unknown }).cause;
      reject(cause instanceof AiEndpointError ? cause : error);
    });
    request.end(body);
  });
}
