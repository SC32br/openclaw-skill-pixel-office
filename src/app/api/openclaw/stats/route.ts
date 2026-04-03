import { NextResponse } from "next/server";

/**
 * Aggregates token usage and cost stats from OpenClaw Gateway.
 *
 * Uses POST /tools/invoke sessions_list — same call as sessions/route.ts.
 * Sums totalTokens and estimatedCostUsd across all agent sessions.
 * No dedicated /stats endpoint exists in OpenClaw Gateway (as of 2026.3.x).
 */

export async function GET() {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
  const token = process.env.OPENCLAW_TOKEN || "";

  if (!token) {
    return NextResponse.json({
      totalTokens: 0,
      cost: 0,
      perAgent: {},
      error: "OPENCLAW_TOKEN not set",
    });
  }

  try {
    const res = await fetch(`${gatewayUrl}/tools/invoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tool: "sessions_list", params: {} }),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) throw new Error(`Gateway returned ${res.status}`);

    const data = await res.json();
    const sessions: Array<{
      key?: string;
      totalTokens?: number;
      estimatedCostUsd?: number;
    }> = data?.result?.details?.sessions || [];

    let totalTokens = 0;
    let totalCost = 0;
    const perAgent: Record<string, { tokens: number; cost: number }> = {};

    for (const s of sessions) {
      const key = s.key || "";
      if (!key.startsWith("agent:") || key.includes(":subagent:")) continue;
      const parts = key.split(":");
      const label = parts.length >= 3 ? parts.slice(2).join(":") : key;
      const tokens = s.totalTokens || 0;
      const cost = s.estimatedCostUsd || 0;
      totalTokens += tokens;
      totalCost += cost;
      perAgent[label] = { tokens, cost };
    }

    return NextResponse.json({
      totalTokens,
      cost: totalCost,
      perAgent,
      timestamp: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { totalTokens: 0, cost: 0, perAgent: {}, error: message },
      { status: 503 }
    );
  }
}
