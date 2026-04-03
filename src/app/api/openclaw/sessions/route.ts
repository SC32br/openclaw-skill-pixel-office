import { NextResponse } from "next/server";
import { fetchSessions, gatewayErrorMessage } from "@/lib/openclaw-gateway";

/**
 * GET /api/openclaw/sessions
 *
 * Returns active OpenClaw agent sessions for the Pixel Office map.
 *
 * NOTE: Agent on the map = OpenClaw session (key "agent:main:<label>").
 *   - One bot can serve many agents.
 *   - An agent can have zero bots (headless).
 *   - Count of agents ≠ count of bots ≠ count of workspace folders.
 *
 * When gateway is unreachable or token is missing → returns empty list + error message.
 * No fake mocks. Empty office is the correct fallback.
 */

export interface AgentSession {
  id: string;
  sessionKey: string;
  status: "working" | "idle" | "thinking" | "done" | "error";
  statusText: string | null;
  contextPct: number;
  totalTokens: number;
  estimatedCostUsd: number;
  updatedAt: number;
}

function deriveStatus(raw: string): AgentSession["status"] {
  const s = raw.toLowerCase();
  if (s === "working" || s === "running") return "working";
  if (s === "thinking") return "thinking";
  if (s === "error" || s === "aborted") return "error";
  return "idle";
}

export async function GET() {
  const result = await fetchSessions();

  if (!result.ok) {
    return NextResponse.json(
      {
        agents: [],
        timestamp: Date.now(),
        error: gatewayErrorMessage(result.error),
      },
      { status: result.error.kind === "rate_limited" ? 429 : 503 }
    );
  }

  const sessions = result.data?.sessions ?? [];

  const agents: AgentSession[] = sessions
    .filter((s) => {
      const key = s.key ?? "";
      // Only named agent sessions — skip heartbeat, subagents, system sessions
      return (
        key.startsWith("agent:") &&
        !key.includes(":subagent:") &&
        s.displayName !== "heartbeat"
      );
    })
    .map((s) => {
      const key = s.key ?? "";
      const parts = key.split(":");
      const label = parts.length >= 3 ? parts.slice(2).join(":") : key;
      const ctxTokens = s.contextTokens ?? 0;

      return {
        id: label,
        sessionKey: key,
        status: deriveStatus(s.status ?? ""),
        statusText: s.displayName !== label ? (s.displayName ?? null) : null,
        contextPct: Math.round((ctxTokens / 120000) * 100),
        totalTokens: s.totalTokens ?? 0,
        estimatedCostUsd: s.estimatedCostUsd ?? 0,
        updatedAt: s.updatedAt ?? Date.now(),
      };
    });

  return NextResponse.json({ agents, timestamp: Date.now() });
}
