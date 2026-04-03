import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Lightweight healthcheck — no auth required.
 * Used by systemd ExecStartPost, monitoring, and smoke tests.
 *
 * Returns:
 *   200 { status: "ok", gateway: "reachable" | "unreachable" | "no_token", uptime: <seconds> }
 *
 * Does NOT expose token, internal paths, or sensitive data.
 */
export async function GET() {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? "http://localhost:18789";
  const hasToken = Boolean(process.env.OPENCLAW_TOKEN);

  let gatewayStatus: "reachable" | "unreachable" | "no_token" = "no_token";

  if (hasToken) {
    try {
      const res = await fetch(`${gatewayUrl}/tools/invoke`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENCLAW_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool: "sessions_list", params: {} }),
        signal: AbortSignal.timeout(2000),
      });
      gatewayStatus = res.ok ? "reachable" : "unreachable";
    } catch {
      gatewayStatus = "unreachable";
    }
  }

  return NextResponse.json(
    {
      status: "ok",
      gateway: gatewayStatus,
      uptime: Math.floor(process.uptime()),
      ts: Date.now(),
    },
    {
      headers: {
        // No caching — always fresh
        "Cache-Control": "no-store",
      },
    }
  );
}
