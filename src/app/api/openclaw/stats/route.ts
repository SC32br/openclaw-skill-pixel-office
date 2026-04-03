import { NextResponse } from "next/server";

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
        return NextResponse.json(data);
      }
    }
  } catch {
    // Gateway unavailable — use mock
  }

  return NextResponse.json({
    totalTokens: 0,
    cost: 0,
    pricing: { input: 5, output: 25 },
    perAgent: {},
  });
}
