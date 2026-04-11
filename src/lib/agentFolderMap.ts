/**
 * Maps OpenClaw agent folder names under ~/.openclaw/agents/<name>/sessions to dashboard agent IDs.
 * Folder names from the filesystem are used as-is unless listed here (e.g. legacy aliases).
 */
export const OPENCLAW_FOLDER_TO_AGENT_ID: Record<string, string> = {
  // Example: main: "agent-main",
};

export function canonicalDashboardAgentId(folderName: string): string {
  return OPENCLAW_FOLDER_TO_AGENT_ID[folderName] ?? folderName;
}
