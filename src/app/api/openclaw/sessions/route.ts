import { NextResponse } from "next/server";

// SESSION_LABEL_MAP: optional mapping from session label to display agent ID.
// Fill this in via env or leave empty to use session labels as-is.
// Example: { "main": "coordinator", "my-agent": "my-agent" }
const SESSION_LABEL_MAP: Record<string, string> = {};

// MOCK_AGENTS: shown when OpenClaw gateway is unavailable.
// Generic placeholders — replace with your own agent IDs after setup.
const MOCK_AGENTS = [
  { id: "agent-1", status: "working", statusText: "Processing tasks", contextPct: 45 },
  { id: "agent-2", status: "idle", statusText: null, contextPct: 0 },
  { id: "agent-3", status: "idle", statusText: null, contextPct: 0 },
];

export async function GET() {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
  const token = process.env.OPENCLAW_TOKEN || "";

  try {
    if (token) {
      const res = await fetch(`${gatewayUrl}/api/v1/sessions/list`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        const sessions = data.sessions || [];
        const agentList = sessions
          .map((s: { label?: string; status?: string; statusText?: string; contextPct?: number }) => {
            const label = s.label || "";
            const agentId = SESSION_LABEL_MAP[label] || label;
            return {
              id: agentId,
              status: s.status || "idle",
              statusText: s.statusText || null,
              contextPct: s.contextPct || 0,
            };
          })
          .filter((a: { id: string }) => a.id);

        return NextResponse.json({ agents: agentList, timestamp: Date.now() });
      }
    }
  } catch {
    // Gateway unavailable — use mock
  }

  return NextResponse.json({ agents: MOCK_AGENTS, timestamp: Date.now() });
}
