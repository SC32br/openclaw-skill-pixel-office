import { NextResponse } from "next/server";

/**
 * Fetches active agent sessions from OpenClaw Gateway.
 *
 * Uses POST /tools/invoke with tool="sessions_list" — the real OpenClaw Gateway API.
 * Falls back to an empty list (not fake mocks) if gateway is unreachable or token is missing.
 *
 * Session shape from gateway:
 *   key, kind, channel, displayName, status, contextTokens, totalTokens,
 *   estimatedCostUsd, updatedAt, startedAt, endedAt
 *
 * NOTE: An "agent" in Pixel Office = an OpenClaw session with a label (agent:main:<label>).
 * One bot can run many agents. One agent can have no bot at all.
 * The list here reflects sessions, NOT bots or workspace folders.
 */

export interface AgentSession {
  id: string;          // session label (e.g. "debosh-marketer", "main")
  sessionKey: string;  // full key (e.g. "agent:main:debosh-marketer")
  status: "working" | "idle" | "thinking" | "done" | "error";
  statusText: string | null;
  contextPct: number;  // 0-100, derived from contextTokens / 120000
  totalTokens: number;
  estimatedCostUsd: number;
  updatedAt: number;
}

function deriveStatus(s: {
  status?: string;
  contextTokens?: number;
}): AgentSession["status"] {
  const raw = (s.status || "").toLowerCase();
  if (raw === "working" || raw === "running") return "working";
  if (raw === "thinking") return "thinking";
  if (raw === "error" || raw === "aborted") return "error";
  if (raw === "done" || raw === "idle" || raw === "") return "idle";
  return "idle";
}

export async function GET() {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
  const token = process.env.OPENCLAW_TOKEN || "";

  // No token → empty office, not fake agents
  if (!token) {
    return NextResponse.json({
      agents: [],
      timestamp: Date.now(),
      error: "OPENCLAW_TOKEN not set — set it in .env to see your agents",
    });
  }

  try {
    // Real OpenClaw Gateway API: POST /tools/invoke
    const res = await fetch(`${gatewayUrl}/tools/invoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tool: "sessions_list", params: {} }),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      throw new Error(`Gateway returned ${res.status}`);
    }

    const data = await res.json();

    // Response shape: { ok: true, result: { details: { sessions: [...] } } }
    const sessions: Array<{
      key?: string;
      displayName?: string;
      label?: string;
      status?: string;
      contextTokens?: number;
      totalTokens?: number;
      estimatedCostUsd?: number;
      updatedAt?: number;
    }> = data?.result?.details?.sessions || [];

    const agents: AgentSession[] = sessions
      .filter((s) => {
        // Only show named agent sessions — skip heartbeat, subagents, etc.
        const key = s.key || "";
        return key.startsWith("agent:") && !key.includes(":subagent:");
      })
      .map((s) => {
        const key = s.key || "";
        // key format: "agent:main:<label>" → extract label
        const parts = key.split(":");
        const label = parts.length >= 3 ? parts.slice(2).join(":") : key;
        const ctxTokens = s.contextTokens || 0;

        return {
          id: label,
          sessionKey: key,
          status: deriveStatus(s),
          statusText: s.displayName !== label ? (s.displayName || null) : null,
          contextPct: Math.round((ctxTokens / 120000) * 100),
          totalTokens: s.totalTokens || 0,
          estimatedCostUsd: s.estimatedCostUsd || 0,
          updatedAt: s.updatedAt || Date.now(),
        };
      });

    return NextResponse.json({ agents, timestamp: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        agents: [],
        timestamp: Date.now(),
        error: `Gateway unreachable: ${message}`,
      },
      { status: 503 }
    );
  }
}
