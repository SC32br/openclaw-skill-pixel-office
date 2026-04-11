"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAgentsStore } from "@/stores/agentsStore";
import { formatTokenCount } from "@/lib/formatUsage";

const PixelOffice = dynamic(
  () => import("@/components/office/PixelOffice").then((m) => m.PixelOffice),
  { ssr: false },
);

interface ActivityItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  details: string | null;
  createdAt: string | null;
}

export default function StreamPage() {
  const { agents, costs, totalsTokens, totalsCostUsd, fetchAgents, fetchLiveStatus, fetchCosts } =
    useAgentsStore();
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [crtEnabled, setCrtEnabled] = useState(true);
  const [displayTokens, setDisplayTokens] = useState(0);
  const officeRef = useRef<{ triggerAllMeeting: () => void } | null>(null);

  useEffect(() => {
    if (displayTokens === totalsTokens) return;
    const diff = totalsTokens - displayTokens;
    const step = Math.max(1, Math.ceil(Math.abs(diff) / 20));
    const timer = setTimeout(() => {
      setDisplayTokens((prev) =>
        diff > 0 ? Math.min(prev + step, totalsTokens) : Math.max(prev - step, totalsTokens),
      );
    }, 30);
    return () => clearTimeout(timer);
  }, [totalsTokens, displayTokens]);

  async function fetchFeed() {
    try {
      const res = await fetch("/api/activity/feed");
      if (res.ok) {
        const data = await res.json();
        setFeed(data.feed);
      }
    } catch {}
  }

  useEffect(() => {
    fetchAgents().then(() => {
      fetchLiveStatus();
      fetchCosts();
    });
    fetchFeed();
    const agentInterval = setInterval(fetchLiveStatus, 10000);
    const feedInterval = setInterval(fetchFeed, 10000);
    const costInterval = setInterval(fetchCosts, 10000);
    return () => {
      clearInterval(agentInterval);
      clearInterval(feedInterval);
      clearInterval(costInterval);
    };
  }, [fetchAgents, fetchLiveStatus, fetchCosts]);

  const onlineAgents = agents.filter((a) => a.currentStatus !== "offline");

  function getActivityMessage(item: ActivityItem): string {
    try {
      const details = item.details ? JSON.parse(item.details) : {};
      if (details.message) return details.message;
      if (details.statusText) return details.statusText;
      return `${item.entityType} ${item.action}`;
    } catch {
      return `${item.entityType} ${item.action}`;
    }
  }

  function getAgentForActivity(item: ActivityItem) {
    if (item.entityType === "agent") return agents.find((a) => a.id === item.entityId);
    return null;
  }

  const STATUS_COLORS: Record<string, string> = {
    working: "text-green-400",
    thinking: "text-yellow-400",
    busy: "text-orange-400",
    idle: "text-gray-500",
    offline: "text-gray-700",
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a12]">
      <header className="h-11 bg-[#0f0f0f] border-b border-[#2a2a2a] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">🤖</span>
          <h1 className="text-base font-bold tracking-wider text-white">
            Pixel Office <span className="text-[#ecb00a]">AI Office</span>
          </h1>
          <span className="text-[10px] text-[#9ca3af] border border-[#2a2a2a] px-1.5 py-0.5 rounded">LIVE</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 justify-end overflow-x-auto overflow-y-hidden [scrollbar-width:thin]">
          <span className="text-[10px] text-[#9ca3af] font-mono whitespace-nowrap shrink-0">
            {agents.length} агентов • {onlineAgents.length} онлайн
          </span>
          <div
            className="flex items-center gap-2 px-2 py-0.5 rounded border border-[#2a2a2a]/60 bg-[#0a0a12]/50 shrink-0"
            title="All-time totals — same data as /office/costs (JSONL sessions)"
          >
            <span className="text-[10px] text-[#ecb00a] font-mono tabular-nums whitespace-nowrap">
              {formatTokenCount(displayTokens)} tokens
            </span>
            <span className="text-[10px] text-green-400/85 font-mono tabular-nums whitespace-nowrap">
              ${totalsCostUsd.toFixed(2)}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-green-400 shrink-0">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-pulse" />
          </span>
          <Link
            href="/office/costs"
            className="text-[10px] text-[#9ca3af] hover:text-white border border-[#2a2a2a] px-2 py-0.5 rounded transition-colors cursor-pointer shrink-0 inline-block"
            title="Cost breakdown"
          >
            Costs
          </Link>
          <button
            type="button"
            onClick={() => setCrtEnabled((v) => !v)}
            className="text-[10px] text-[#9ca3af] hover:text-white border border-[#2a2a2a] px-2 py-0.5 rounded transition-colors cursor-pointer shrink-0"
          >
            CRT {crtEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#0a0a12]">
          <div className="w-full h-full pointer-events-none select-none">
            <PixelOffice ref={officeRef} agents={agents} className="w-full h-full" />
          </div>
          {crtEnabled && <div className="crt-overlay" />}

          <div className="absolute bottom-3 left-3 text-[10px] text-green-400 bg-[#0f0f0f]/80 border border-[#2a2a2a] px-3 py-1.5 rounded backdrop-blur flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-pulse" />
            LIVE
          </div>

          <div className="absolute bottom-3 right-3 pointer-events-auto z-10">
            <button
              type="button"
              onClick={() => officeRef.current?.triggerAllMeeting()}
              className="text-[10px] bg-[#ecb00a]/20 hover:bg-[#ecb00a]/40 text-[#ecb00a] border border-[#ecb00a]/30 px-3 py-1.5 rounded backdrop-blur transition-colors cursor-pointer"
            >
              🤝 Собрать всех
            </button>
          </div>
        </main>

        <aside className="w-72 bg-[#0f0f0f] border-l border-[#2a2a2a] flex flex-col shrink-0 overflow-hidden hidden md:flex">
          <div className="p-4 border-b border-[#2a2a2a]/50">
            <h3 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
              👥 Агенты
            </h3>
            <div className="space-y-2.5">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-3 text-sm">
                  <span className="text-xl">{agent.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{agent.name}</div>
                    <div className="text-xs text-[#6b7280] truncate">{agent.role}</div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className={`text-xs font-medium ${STATUS_COLORS[agent.currentStatus ?? "idle"]}`}
                    >
                      ●&nbsp;
                      {agent.currentStatus === "working"
                        ? "Working"
                        : agent.currentStatus === "thinking"
                          ? "Thinking"
                          : agent.currentStatus === "busy"
                            ? "Busy"
                            : agent.currentStatus === "offline"
                              ? "Offline"
                              : "Idle"}
                    </span>
                    <span
                      className="text-[10px] font-mono tabular-nums text-[#6b7280]"
                      title="USD from session logs — same as /office/costs"
                    >
                      ${(costs[agent.id] ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full inline-block animate-pulse" />
              Live Feed
            </h3>
            <div className="space-y-2">
              {feed.map((item) => {
                const agent = getAgentForActivity(item);
                return (
                  <div key={item.id} className="text-xs py-1.5 border-b border-[#2a2a2a]/30">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[#6b7280]">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleTimeString("ru", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                      {agent && <span>{agent.emoji}</span>}
                    </div>
                    <div className="text-[#e4e6f0]">{getActivityMessage(item)}</div>
                  </div>
                );
              })}
              {feed.length === 0 && (
                <div className="text-[#6b7280] text-xs">Ожидаем активность...</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
