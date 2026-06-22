import type { WorkspaceWithConfig, WorkspacesResponse } from "../types/api";

export async function fetchWorkspaces(): Promise<WorkspacesResponse> {
  const response = await fetch("/api/v1/workspaces");
  if (!response.ok) {
    throw new Error("Failed to load workspaces");
  }
  return (await response.json()) as WorkspacesResponse;
}

export async function selectWorkspace(id: string): Promise<WorkspaceWithConfig> {
  const response = await fetch(`/api/v1/workspaces/${id}/select`, { method: "POST" });
  const payload = (await response.json()) as { message?: string; workspace: WorkspaceWithConfig };
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to select workspace");
  }
  return payload.workspace;
}

export function findActiveWorkspace(
  workspaces: WorkspaceWithConfig[],
  activeWorkspaceId: string | null,
): WorkspaceWithConfig | null {
  if (!activeWorkspaceId) {
    return null;
  }
  return workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
}

export function shortenPath(directory: string, maxLength = 36): string {
  const normalized = directory.replace(/\\/g, "/");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const head = normalized.slice(0, 14);
  const tail = normalized.slice(-18);
  return `${head}…${tail}`;
}
