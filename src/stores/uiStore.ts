"use client";

import { create } from "zustand";

interface UiState {
  sidebarOpen: boolean;
  agentProfileId: string | null;
  toggleSidebar: () => void;
  openAgentProfile: (id: string) => void;
  closeAgentProfile: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  agentProfileId: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openAgentProfile: (id) => set({ agentProfileId: id }),
  closeAgentProfile: () => set({ agentProfileId: null }),
}));
