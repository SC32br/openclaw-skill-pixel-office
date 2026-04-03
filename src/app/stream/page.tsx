"use client";

import { useEffect, useState, useRef } from "react";
import { useAgentsStore } from "@/stores/agentsStore";
import { PixelOffice } from "@/components/office/PixelOffice";

interface ActivityItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  details: string | null;
  createdAt: string | null;
}

export default function StreamPage() {
  const { agents, costs, fetchAgents, fetchLiveStatus, fetchCosts } = useAgentsStore();
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [crtEnabled, setCrtEnabled] = useState(true);
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenCost, setTokenCost] = useState(0);
  const [displayTokens, setDisplayTokens] = useState(0);
  const officeRef = useRef<any>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/openclaw/stats?t=" + Date.now());
        if (res.ok) {
          const data = await res.json();
          setTokenCount(data.totalTokens || 0);
          setTokenCost(data.cost || 0);
        }
      } catch {}
    }
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (displayTokens === tokenCount) return;
    const diff = tokenCount - displayTokens;
    const step = Math.max(1, Math.ceil(Math.abs(diff) / 20));
    const timer = setTimeout(() => {
      setDisplayTokens(prev => diff > 0 ? Math.min(prev + step, tokenCount) : Math.max(prev - step, tokenCount));
    }, 30);
    return () => clearTimeout(timer);
  }, [tokenCount, displayTokens]);

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
    fetchAgents().then(() => { fetchLiveStatus(); fetchCosts(); });
    fetchFeed();
    const agentInterval = setInterval(fetchLiveStatus, 10000);
    const feedInterval = setInterval(fetchFeed, 10000);
    const costInterval = setInterval(fetchCosts, 30000);
    return () => {
      clearInterval(agentInterval);
      clearInterval(feedInterval);
      clearInterval(costInterval);
    };
  }, [fetchAgents, fetchLiveStatus, fetchCosts]);

  const onlineAgents = agents.filter(a => a.currentStatus !== "offline");

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
    if (item.entityType === "agent") return agents.find(a => a.id === item.entityId);
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
      {/* Header */}
      <header className="h-11 bg-[#0f0f0f] border-b border-[#2a2a2a] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">🤖</span>
          <h1 className="text-base font-bold tracking-wider text-white">
            Pixel Office <span className="text-[#ecb00a]">AI Office</span>
          </h1>
          <span className="text-[10px] text-[#9ca3af] border border-[#2a2a2a] px-1.5 py-0.5 rounded">LIVE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#9ca3af] font-mono">
            {agents.length} агентов • {onlineAgents.length} онлайн
          </span>
          {tokenCount > 0 && (
            <span className="text-[10px] text-[#ecb00a] font-mono tabular-nums">
              {(tokenCount / 1000).toFixed(1)}k tokens
            </span>
          )}
          {tokenCost > 0 && (
            <span className="text-[10px] text-green-400/70 font-mono">${tokenCost.toFixed(2)}</span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-green-400">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-pulse" />
          </span>
          <button
            onClick={() => setCrtEnabled(v => !v)}
            className="text-[10px] text-[#9ca3af] hover:text-white border border-[#2a2a2a] px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            CRT {crtEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </header>

      {/* Main */}
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
              onClick={() => officeRef.current?.triggerAllMeeting()}
              className="text-[10px] bg-[#ecb00a]/20 hover:bg-[#ecb00a]/40 text-[#ecb00a] border border-[#ecb00a]/30 px-3 py-1.5 rounded backdrop-blur transition-colors cursor-pointer"
            >
              🤝 Собрать всех
            </button>
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="w-72 bg-[#0f0f0f] border-l border-[#2a2a2a] flex flex-col shrink-0 overflow-hidden hidden md:flex">
          {/* Agents */}
          <div className="p-4 border-b border-[#2a2a2a]/50">
            <h3 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
              👥 Агенты
            </h3>
            <div className="space-y-2.5">
              {agents.map(agent => (
                <div key={agent.id} className="flex items-center gap-3 text-sm">
                  <span className="text-xl">{agent.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{agent.name}</div>
                    <div className="text-xs text-[#6b7280] truncate">{agent.role}</div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`text-xs font-medium ${STATUS_COLORS[agent.currentStatus ?? "idle"]}`}>
                      ●&nbsp;{agent.currentStatus === "working" ? "Working"
                        : agent.currentStatus === "thinking" ? "Thinking"
                        : agent.currentStatus === "busy" ? "Busy"
                        : agent.currentStatus === "offline" ? "Offline"
                        : "Idle"}
                    </span>
                    {costs[agent.id] > 0 && (
                      <span className="text-[10px] text-[#6b7280] font-mono">${costs[agent.id].toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Feed */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full inline-block animate-pulse" />
              Live Feed
            </h3>
            <div className="space-y-2">
              {feed.map(item => {
                const agent = getAgentForActivity(item);
                return (
                  <div key={item.id} className="text-xs py-1.5 border-b border-[#2a2a2a]/30">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[#6b7280]">
                        {item.createdAt ? new Date(item.createdAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : ""}
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
