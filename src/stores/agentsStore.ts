"use client";

import { create } from "zustand";
import type { Agent } from "@/lib/utils/types";

interface AgentsState {
  agents: Agent[];
  costs: Record<string, number>;
  isLoading: boolean;
  fetchAgents: () => Promise<void>;
  fetchLiveStatus: () => Promise<void>;
  fetchCosts: () => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  costs: {},
  isLoading: false,

  fetchAgents: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        set({ agents: data.agents, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  fetchLiveStatus: async () => {
    try {
      const res = await fetch("/api/openclaw/sessions");
      if (!res.ok) return;
      const data = await res.json();
      const liveAgents = data.agents || [];

      const current = get().agents;
      const updated = current.map((agent) => {
        const live = liveAgents.find((la: { id: string }) => la.id === agent.id);
        if (live) {
          return {
            ...agent,
            currentStatus: live.status as Agent["currentStatus"],
            description: live.statusText,
            contextPct: live.contextPct || 0,
          };
        }
        return agent;
      });

      set({ agents: updated });
    } catch {
      // silent fail
    }
  },

  fetchCosts: async () => {
    try {
      const res = await fetch("/api/openclaw/stats");
      if (!res.ok) return;
      const data = await res.json();
      const perAgent = data.perAgent || {};
      const inputPrice = data.pricing?.input || 5;
      const outputPrice = data.pricing?.output || 25;
      const costMap: Record<string, number> = {};
      for (const [key, stats] of Object.entries(perAgent) as [string, any][]) {
        if (stats) {
          costMap[key] = Math.round(((stats.inputTokens / 1e6) * inputPrice + (stats.outputTokens / 1e6) * outputPrice) * 100) / 100;
        }
      }
      set({ costs: costMap });
    } catch {}
  },
}));
