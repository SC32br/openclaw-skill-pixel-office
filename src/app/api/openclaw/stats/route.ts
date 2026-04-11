import { NextResponse } from "next/server";
import { fetchSessions, gatewayErrorMessage } from "@/lib/openclaw-gateway";
import { jsonlTotalsForStatsFallback } from "@/lib/jsonlCostAggregate";

function pricingFromEnv() {
  return {
    input: Number(process.env.OPENCLAW_COST_INPUT_PER_M ?? 3),
    output: Number(process.env.OPENCLAW_COST_OUTPUT_PER_M ?? 15),
  };
}

/**
 * GET /api/openclaw/stats
 *
 * Tries in order:
 * 1. Gateway /api/v1/stats (when OPENCLAW_TOKEN is set and returns non-zero totals)
 * 2. Aggregates from sessions_list (totalTokens / estimatedCostUsd per session)
 * 3. Fallback: sums from local session *.jsonl logs (same basis as /api/openclaw/cost-report)
 */
export async function GET() {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
  const token = process.env.OPENCLAW_TOKEN || "";

  try {
    if (token) {
      const res = await fetch(`${gatewayUrl}/api/v1/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        const totalTokens = Number(data.totalTokens) || 0;
        const cost = Number(data.cost) || 0;
        if (totalTokens > 0 || cost > 0) {
          return NextResponse.json(data);
        }
      }
    }
  } catch {
    // fall through to sessions / JSONL
  }

  const result = await fetchSessions();

  if (result.ok) {
    const sessions = result.data?.sessions ?? [];
    let totalTokens = 0;
    let totalCost = 0;
    const perAgent: Record<string, { tokens: number; cost: number }> = {};

    for (const s of sessions) {
      const key = s.key ?? "";
      if (!key.startsWith("agent:") || key.includes(":subagent:")) continue;
      const parts = key.split(":");
      const label = parts.length >= 3 ? parts.slice(2).join(":") : key;
      const tok = s.totalTokens ?? 0;
      const cst = s.estimatedCostUsd ?? 0;
      totalTokens += tok;
      totalCost += cst;
      perAgent[label] = { tokens: tok, cost: cst };
    }

    if (totalTokens > 0 || totalCost > 0) {
      return NextResponse.json({
        totalTokens,
        cost: totalCost,
        perAgent,
        pricing: pricingFromEnv(),
        timestamp: Date.now(),
        source: "sessions",
      });
    }
  }

  try {
    const fb = await jsonlTotalsForStatsFallback();
    return NextResponse.json({
      totalTokens: fb.totalTokens,
      cost: fb.costUsd,
      pricing: pricingFromEnv(),
      perAgent: fb.perAgent,
      source: "session_logs",
      ...(!result.ok ? { gatewayError: gatewayErrorMessage(result.error) } : {}),
    });
  } catch {
    return NextResponse.json(
      {
        totalTokens: 0,
        cost: 0,
        pricing: pricingFromEnv(),
        perAgent: {},
        source: "empty",
        error: !result.ok ? gatewayErrorMessage(result.error) : undefined,
      },
      { status: !result.ok ? 503 : 200 },
    );
  }
}
