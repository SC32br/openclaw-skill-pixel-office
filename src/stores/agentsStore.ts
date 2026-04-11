"use client";

import { create } from "zustand";
import type { Agent } from "@/lib/utils/types";
import { normalizeCostReport } from "@/lib/normalizeCostReport";

interface AgentsState {
  agents: Agent[];
  /** Per-agent USD — same rules as «By agents» on /office/costs (JSONL). */
  costs: Record<string, number>;
  /** All-time totals — same as report.totals on costs page (range=all). */
  totalsTokens: number;
  totalsCostUsd: number;
  isLoading: boolean;
  fetchAgents: () => Promise<void>;
  fetchLiveStatus: () => Promise<void>;
  fetchCosts: () => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  costs: {},
  totalsTokens: 0,
  totalsCostUsd: 0,
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
      const res = await fetch(`/api/openclaw/cost-report?range=all&t=${Date.now()}`);
      if (!res.ok) return;
      const raw: unknown = await res.json();
      const report = normalizeCostReport(raw);
      const costMap: Record<string, number> = {};
      for (const [id, bucket] of Object.entries(report.byAgent)) {
        costMap[id] = bucket.costUsd;
      }
      set({
        costs: costMap,
        totalsTokens: report.totals.tokens,
        totalsCostUsd: report.totals.costUsd,
      });
    } catch {}
  },
}));
