import { NextResponse } from "next/server";

const SESSION_LABEL_MAP: Record<string, string> = {
  main: "debosh-main",
  "debosh-main": "debosh-main",
  "debosh-marketer": "debosh-marketer",
  "debosh-copywriter": "debosh-copywriter",
  "debosh-poster": "debosh-poster",
  "debosh-storymaker": "debosh-storymaker",
  "debosh-analyst": "debosh-analyst",
  "debosh-targetologist": "debosh-targetologist",
  "debosh-stats": "debosh-stats",
  "carousel-maker": "carousel-maker",
  "debosh-video": "debosh-video",
};

const MOCK_AGENTS = [
  { id: "debosh-main", status: "working", statusText: "Координирую задачи", contextPct: 45 },
  { id: "debosh-marketer", status: "idle", statusText: null, contextPct: 0 },
  { id: "debosh-copywriter", status: "idle", statusText: null, contextPct: 0 },
  { id: "debosh-poster", status: "idle", statusText: null, contextPct: 0 },
  { id: "debosh-storymaker", status: "idle", statusText: null, contextPct: 0 },
  { id: "debosh-analyst", status: "idle", statusText: null, contextPct: 0 },
  { id: "debosh-targetologist", status: "idle", statusText: null, contextPct: 0 },
  { id: "debosh-stats", status: "idle", statusText: null, contextPct: 0 },
  { id: "carousel-maker", status: "idle", statusText: null, contextPct: 0 },
  { id: "debosh-video", status: "idle", statusText: null, contextPct: 0 },
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
