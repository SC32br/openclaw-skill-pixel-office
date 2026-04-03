/**
 * openclaw-gateway.ts
 *
 * Thin adapter for OpenClaw Gateway API.
 * All Gateway calls go through here — UI never calls Gateway directly.
 *
 * Gateway API contract (OpenClaw 2026.3.x):
 *   POST /tools/invoke   { tool: string, params: object }
 *   → { ok: true, result: { details: <tool-specific> } }
 *   → { error: { message: string, type: string } }   on failure
 *
 * Tools used by Pixel Office:
 *   sessions_list  → { count: number, sessions: GatewaySession[] }
 *
 * Error handling:
 *   401  → token invalid or missing
 *   429  → rate-limited — back off, do not retry immediately
 *   503  → gateway down — show empty office, log warning
 *   empty sessions [] → normal when no agents are running
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Raw session shape from Gateway sessions_list */
export interface GatewaySession {
  key: string;              // "agent:main:<label>"
  kind: string;             // "other" | "direct" | ...
  channel: string;
  displayName: string;
  status: string;           // "working" | "idle" | "done" | "error" | ...
  contextTokens: number;    // current context window usage in tokens
  totalTokens: number;      // cumulative tokens this session
  estimatedCostUsd: number;
  updatedAt: number;        // unix ms
  startedAt?: number;
  endedAt?: number;
  sessionId?: string;
  model?: string;
  [key: string]: unknown;   // forward-compat: log unknown fields, don't break
}

export interface SessionsListResult {
  count: number;
  sessions: GatewaySession[];
}

export type GatewayError =
  | { kind: "unauthorized" }
  | { kind: "rate_limited"; retryAfterMs?: number }
  | { kind: "unreachable"; message: string }
  | { kind: "unknown"; status: number; message: string };

export type GatewayResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: GatewayError };

// ─── Config ─────────────────────────────────────────────────────────────────

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? "http://localhost:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_TOKEN ?? "";
const TIMEOUT_MS = 5000;

// ─── Core invoke ────────────────────────────────────────────────────────────

async function invoke<T>(
  tool: string,
  params: Record<string, unknown> = {}
): Promise<GatewayResult<T>> {
  if (!GATEWAY_TOKEN) {
    return { ok: false, error: { kind: "unauthorized" } };
  }

  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tool, params }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[gateway] unreachable: ${message}`);
    return { ok: false, error: { kind: "unreachable", message } };
  }

  if (res.status === 401) {
    console.warn("[gateway] 401 Unauthorized — check OPENCLAW_TOKEN");
    return { ok: false, error: { kind: "unauthorized" } };
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : undefined;
    console.warn(`[gateway] 429 Rate limited — retry after ${retryAfterMs ?? "?"}ms`);
    return { ok: false, error: { kind: "rate_limited", retryAfterMs } };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[gateway] HTTP ${res.status}: ${body.slice(0, 200)}`);
    return {
      ok: false,
      error: { kind: "unknown", status: res.status, message: body.slice(0, 200) },
    };
  }

  const json = await res.json();

  if (!json.ok) {
    const msg = json.error?.message ?? "Unknown gateway error";
    console.warn(`[gateway] tool=${tool} error: ${msg}`);
    return { ok: false, error: { kind: "unknown", status: 200, message: msg } };
  }

  // Log any unexpected top-level fields for forward-compat visibility
  const knownFields = new Set(["ok", "result"]);
  for (const field of Object.keys(json)) {
    if (!knownFields.has(field)) {
      console.info(`[gateway] unknown top-level field: "${field}" — OpenClaw may have updated its API`);
    }
  }

  return { ok: true, data: json.result?.details as T };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch all active agent sessions from OpenClaw Gateway.
 * Returns empty array (not an error) when no agents are running.
 */
export async function fetchSessions(): Promise<GatewayResult<SessionsListResult>> {
  return invoke<SessionsListResult>("sessions_list");
}

/**
 * Human-readable error message for UI display.
 * Never exposes the token or internal paths.
 */
export function gatewayErrorMessage(error: GatewayError): string {
  switch (error.kind) {
    case "unauthorized":
      return "Gateway: token missing or invalid. Set OPENCLAW_TOKEN in .env.local";
    case "rate_limited":
      return `Gateway: rate limited${error.retryAfterMs ? ` — retry in ${Math.ceil(error.retryAfterMs / 1000)}s` : ""}`;
    case "unreachable":
      return "Gateway unreachable — is OpenClaw running?";
    case "unknown":
      return `Gateway error (HTTP ${error.status})`;
  }
}
