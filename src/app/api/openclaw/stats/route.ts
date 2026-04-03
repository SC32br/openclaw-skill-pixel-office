import { NextResponse } from "next/server";
import { fetchSessions, gatewayErrorMessage } from "@/lib/openclaw-gateway";

/**
 * GET /api/openclaw/stats
 *
 * Aggregates token usage and cost from Gateway sessions.
 * No dedicated stats endpoint exists in OpenClaw Gateway (2026.3.x).
 * Stats are derived from sessions_list fields: totalTokens, estimatedCostUsd.
 */

export async function GET() {
  const result = await fetchSessions();

  if (!result.ok) {
    return NextResponse.json(
      { totalTokens: 0, cost: 0, perAgent: {}, error: gatewayErrorMessage(result.error) },
      { status: 503 }
    );
  }

  const sessions = result.data?.sessions ?? [];
  let totalTokens = 0;
  let totalCost = 0;
  const perAgent: Record<string, { tokens: number; cost: number }> = {};

  for (const s of sessions) {
    const key = s.key ?? "";
    if (!key.startsWith("agent:") || key.includes(":subagent:")) continue;
    const parts = key.split(":");
    const label = parts.length >= 3 ? parts.slice(2).join(":") : key;
    const tokens = s.totalTokens ?? 0;
    const cost = s.estimatedCostUsd ?? 0;
    totalTokens += tokens;
    totalCost += cost;
    perAgent[label] = { tokens, cost };
  }

  return NextResponse.json({ totalTokens, cost: totalCost, perAgent, timestamp: Date.now() });
}
